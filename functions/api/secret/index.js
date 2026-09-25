/**
 * POST /api/secret
 * 暗号化されたシークレットを受け取り、D1データベースへ保存して一意なIDを発行する
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // D1バインディングの存在チェック
  if (!env.DB) {
    return new Response(
      JSON.stringify({ error: 'データベース設定が見つかりません。' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const { ciphertext, iv, content_type, ttl_seconds, turnstile_token } = body;

    // 1. Turnstile (ボット防止認証) の検証
    const turnstileSecret = env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';
    const clientIp = request.headers.get('CF-Connecting-IP');

    if (turnstile_token) {
      const verifyFormData = new FormData();
      verifyFormData.append('secret', turnstileSecret);
      verifyFormData.append('response', turnstile_token);
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
      // 本番環境（シークレットキー設定時）でトークンが存在しない場合は遮断
      return new Response(
        JSON.stringify({ error: 'ボット防止認証トークンが指定されていません。' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. バリデーション: 必須項目チェック
    if (!ciphertext || typeof ciphertext !== 'string') {
      return new Response(
        JSON.stringify({ error: '暗号文 (ciphertext) が指定されていません。' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (!iv || typeof iv !== 'string') {
      return new Response(
        JSON.stringify({ error: '初期化ベクトル (iv) が指定されていません。' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 容量制限: 最大 64KB (DoS / ストレージ枯渇防止)
    if (ciphertext.length > 65536) {
      return new Response(
        JSON.stringify({ error: '暗号文のサイズが上限（64KB）を超えています。' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 有効期限の計算（デフォルト24時間、最短1時間、最長30日: 2592000秒）
    const ttl = Number.isInteger(ttl_seconds) && ttl_seconds >= 3600 && ttl_seconds <= 2592000
      ? ttl_seconds
      : 86400;

    const createdAt = Date.now();
    const expiresAt = createdAt + (ttl * 1000);
    const secretId = crypto.randomUUID();
    const validatedType = content_type === 'note' ? 'note' : 'password';
    // 消去モード: 0 (期限まで保持) または 1 (ワンタイム閲覧後即時消去)
    const burnAfterRead = body.burn_after_read === 0 || body.burn_after_read === false ? 0 : 1;

    // D1 への INSERT 実行
    await env.DB.prepare(
      `INSERT INTO secrets (id, ciphertext, iv, content_type, created_at, expires_at, burn_after_read)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(secretId, ciphertext, iv, validatedType, createdAt, expiresAt, burnAfterRead)
      .run();

    // 発行された ID とメタ情報を返却
    return new Response(
      JSON.stringify({
        id: secretId,
        expires_at: expiresAt,
        burn_after_read: burnAfterRead,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  } catch (err) {
    console.error('シークレット作成エラー:', err);
    return new Response(
      JSON.stringify({ error: 'シークレットの保存中にエラーが発生しました。' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
