/**
 * GET /api/secret/:id
 * シークレット（暗号文・IV）を取得し、即座にD1データベースから完全物理削除する（ワンタイム破棄）
 */

export async function onRequestGet(context) {
  const { params, env } = context;
  const secretId = params.id;

  // D1バインディングの存在チェック
  if (!env.DB) {
    return new Response(
      JSON.stringify({ error: 'データベース設定が見つかりません。' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!secretId || typeof secretId !== 'string') {
    return new Response(
      JSON.stringify({ error: '有効なシークレットIDが指定されていません。' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 1. D1 からシークレットを取得
    const record = await env.DB.prepare(
      `SELECT ciphertext, iv, content_type, expires_at, burn_after_read FROM secrets WHERE id = ?`
    )
      .bind(secretId)
      .first();

    // レコードが存在しない場合
    if (!record) {
      return new Response(
        JSON.stringify({ error: 'シークレットが見つかりません。既に閲覧されたか、存在しない可能性があります。' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = Date.now();

    // 2. 有効期限切れチェック
    if (record.expires_at < now) {
      // 期限切れレコードをクリーンアップ
      await env.DB.prepare(`DELETE FROM secrets WHERE id = ?`).bind(secretId).run();
      return new Response(
        JSON.stringify({ error: 'このシークレットは有効期限が切れています。' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. 【消去モード判定】ワンタイム閲覧（burn_after_read === 1 または 未設定）の場合のみ即座に完全物理削除
    const isOneTime = record.burn_after_read === 1 || record.burn_after_read === null;
    if (isOneTime) {
      await env.DB.prepare(`DELETE FROM secrets WHERE id = ?`).bind(secretId).run();
    }

    // 4. クライアントへ暗号文と初期化ベクトル、および保持モード情報を返却
    return new Response(
      JSON.stringify({
        ciphertext: record.ciphertext,
        iv: record.iv,
        content_type: record.content_type,
        burn_after_read: isOneTime ? 1 : 0,
        expires_at: record.expires_at,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );

  } catch (err) {
    console.error('シークレット取得・削除エラー:', err);
    return new Response(
      JSON.stringify({ error: 'シークレットの取得中にエラーが発生しました。' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
