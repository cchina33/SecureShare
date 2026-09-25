/**
 * GET /api/image/:id
 * 暗号化画像バイナリとメタデータを取得し、ワンタイム閲覧モードの場合は即座に完全物理削除する
 */

export async function onRequestGet(context) {
  const { params, env } = context;
  const imageId = params.id;

  // 1. バインディングの存在確認
  if (!env.DB) {
    return new Response(
      JSON.stringify({ error: 'データベース設定 (DB) が見つかりません。' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!env.MY_BUCKET) {
    return new Response(
      JSON.stringify({ error: 'ストレージ設定 (MY_BUCKET) が見つかりません。' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!imageId || typeof imageId !== 'string') {
    return new Response(
      JSON.stringify({ error: '有効な画像IDが指定されていません。' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 2. D1 から画像メタデータを取得
    const record = await env.DB.prepare(
      `SELECT iv, mime_type, file_size, expires_at, burn_after_read FROM images WHERE id = ?`
    )
      .bind(imageId)
      .first();

    if (!record) {
      return new Response(
        JSON.stringify({ error: '画像が見つかりません。既に閲覧されたか、存在しない可能性があります。' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = Date.now();

    // 3. 有効期限切れチェック
    if (record.expires_at < now) {
      // 期限切れデータを D1 および R2 から削除
      await Promise.allSettled([
        env.DB.prepare(`DELETE FROM images WHERE id = ?`).bind(imageId).run(),
        env.MY_BUCKET.delete(imageId),
      ]);

      return new Response(
        JSON.stringify({ error: 'この画像の有効期限は切れています。' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. R2 から暗号化画像バイナリを取得
    const r2Object = await env.MY_BUCKET.get(imageId);
    if (!r2Object) {
      // データ整合性エラー（D1にのみ存在しR2から消失している場合）
      await env.DB.prepare(`DELETE FROM images WHERE id = ?`).bind(imageId).run();
      return new Response(
        JSON.stringify({ error: '画像データファイルが見つかりません。' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. 【消去モード判定】ワンタイム閲覧（burn_after_read === 1）の場合は即座に完全物理削除
    const isOneTime = record.burn_after_read === 1 || record.burn_after_read === null;
    if (isOneTime) {
      // R2 と D1 から同時に完全削除
      await Promise.all([
        env.DB.prepare(`DELETE FROM images WHERE id = ?`).bind(imageId).run(),
        env.MY_BUCKET.delete(imageId),
      ]);
    }

    // 6. 暗号化バイナリとメタデータヘッダーを返却
    const headers = new Headers();
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('X-Iv', record.iv);
    headers.set('X-Mime-Type', record.mime_type);
    headers.set('X-File-Size', String(record.file_size));
    headers.set('X-Burn-After-Read', isOneTime ? '1' : '0');
    headers.set('X-Expires-At', String(record.expires_at));
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    // クライアント側 fetch からカスタムヘッダーを読み取り可能にする
    headers.set('Access-Control-Expose-Headers', 'X-Iv, X-Mime-Type, X-File-Size, X-Burn-After-Read, X-Expires-At');

    return new Response(r2Object.body, {
      status: 200,
      headers,
    });

  } catch (err) {
    console.error('画像取得・削除エラー:', err);
    return new Response(
      JSON.stringify({ error: '画像の取得処理中にエラーが発生しました。' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
