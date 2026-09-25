/**
 * POST /api/image
 * 暗号化された画像バイナリを R2 バケットへ保管し、メタデータを D1 へ登録する
 */

export async function onRequestPost(context) {
  const { request, env } = context;

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

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const iv = formData.get('iv');
    const mimeType = formData.get('mime_type');
    const ttlSecondsRaw = formData.get('ttl_seconds');
    const burnModeRaw = formData.get('burn_after_read');
    const turnstileToken = formData.get('turnstile_token');

    // 2. Turnstile (ボット防止認証) の検証
    const turnstileSecret = env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';
    const clientIp = request.headers.get('CF-Connecting-IP');

    if (turnstileToken) {
      const verifyFormData = new FormData();
      verifyFormData.append('secret', turnstileSecret);
      verifyFormData.append('response', turnstileToken);
      if (clientIp) {
        verifyFormData.append('remoteip', clientIp);
      }

      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: verifyFormData,
      });

      const outcome = await verifyRes.json();
      if (!outcome.success) {
        return new Response(
          JSON.stringify({ error: 'ボット防止認証（Turnstile）の検証に失敗しました。' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else if (env.TURNSTILE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'ボット防止認証トークンが指定されていません。' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. バリデーション
    if (!file || typeof file === 'string') {
      return new Response(
        JSON.stringify({ error: '暗号化画像ファイル (file) が添付されていません。' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!iv || typeof iv !== 'string') {
      return new Response(
        JSON.stringify({ error: '初期化ベクトル (iv) が指定されていません。' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!mimeType || typeof mimeType !== 'string' || !mimeType.startsWith('image/')) {
      return new Response(
        JSON.stringify({ error: '有効な画像形式 (mime_type) が指定されていません。' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ファイル容量制限: 最大 10MB (10,485,760 バイト)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const fileBuffer = await file.arrayBuffer();
    const fileSize = fileBuffer.byteLength;

    if (fileSize === 0) {
      return new Response(
        JSON.stringify({ error: '空のファイルはアップロードできません。' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (fileSize > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'ファイルサイズが上限（10MB）を超えています。' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 有効期限の計算（最短1時間: 3600秒 〜 最長8日: 691200秒、デフォルト24時間: 86400秒）
    const parsedTtl = parseInt(ttlSecondsRaw, 10);
    const ttl = Number.isInteger(parsedTtl) && parsedTtl >= 3600 && parsedTtl <= 691200
      ? parsedTtl
      : 86400;

    const createdAt = Date.now();
    const expiresAt = createdAt + (ttl * 1000);
    const imageId = crypto.randomUUID();

    // 消去モード: 0 (期限まで保持) または 1 (ワンタイム閲覧後即時消去)
    const burnAfterRead = (burnModeRaw === '0' || burnModeRaw === 0) ? 0 : 1;

    // 4. R2 バケットへ暗号化バイナリを保管
    await env.MY_BUCKET.put(imageId, fileBuffer, {
      httpMetadata: {
        contentType: 'application/octet-stream',
      },
      customMetadata: {
        originalMimeType: mimeType,
      },
    });

    // 5. D1 データベースへメタデータを保存
    await env.DB.prepare(
      `INSERT INTO images (id, iv, mime_type, file_size, created_at, expires_at, burn_after_read)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(imageId, iv, mimeType, fileSize, createdAt, expiresAt, burnAfterRead)
      .run();

    // 6. 成功レスポンスの返却
    return new Response(
      JSON.stringify({
        id: imageId,
        expires_at: expiresAt,
        burn_after_read: burnAfterRead,
        file_size: fileSize,
      }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );

  } catch (err) {
    console.error('画像アップロードエラー:', err);
    return new Response(
      JSON.stringify({ error: '画像アップロード処理中にエラーが発生しました。' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
