/**
 * SecureShare - 作成画面UIロジック (app.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  // 要素の取得
  const tabPassword = document.getElementById('tab-password');
  const tabNote = document.getElementById('tab-note');
  const groupPassword = document.getElementById('group-password');
  const groupNote = document.getElementById('group-note');
  const inputPassword = document.getElementById('input-password');
  const inputNote = document.getElementById('input-note');
  const selectExpire = document.getElementById('select-expire');
  const secretForm = document.getElementById('secret-form');
  const btnCreate = document.getElementById('btn-create');
  const resultBox = document.getElementById('result-box');
  const generatedUrlInput = document.getElementById('generated-url');
  const btnCopyUrl = document.getElementById('btn-copy-url');
  const btnReset = document.getElementById('btn-reset');
  const toast = document.getElementById('toast');

  let activeMode = 'password'; // 'password' または 'note'

  // トースト表示関数
  function showToast(message = 'クリップボードにコピーしました') {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // タブ切り替え処理
  tabPassword.addEventListener('click', () => {
    activeMode = 'password';
    tabPassword.classList.add('active');
    tabPassword.setAttribute('aria-selected', 'true');
    tabNote.classList.remove('active');
    tabNote.setAttribute('aria-selected', 'false');

    groupPassword.style.display = 'block';
    groupNote.style.display = 'none';
  });

  tabNote.addEventListener('click', () => {
    activeMode = 'note';
    tabNote.classList.add('active');
    tabNote.setAttribute('aria-selected', 'true');
    tabPassword.classList.remove('active');
    tabPassword.setAttribute('aria-selected', 'false');

    groupPassword.style.display = 'none';
    groupNote.style.display = 'block';
  });

  // フォーム送信（暗号化およびリンク発行）
  secretForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const textToEncrypt = activeMode === 'password' ? inputPassword.value.trim() : inputNote.value.trim();
    if (!textToEncrypt) {
      alert('共有するパスワードまたは秘密メモを入力してください。');
      return;
    }

    // Turnstile トークンの取得
    const turnstileContainer = document.querySelector('.cf-turnstile');
    const turnstileToken = window.turnstile ? window.turnstile.getResponse() : null;
    if (turnstileContainer && window.turnstile && !turnstileToken) {
      alert('ボット防止認証（Turnstile）のチェックを完了してください。');
      return;
    }

    btnCreate.disabled = true;
    btnCreate.textContent = '暗号化して発行中...';

    try {
      // 1. クライアント側でランダムなAES-GCM暗号鍵を生成
      const key = await window.SecureCrypto.generateAesKey();

      // 2. テキストを暗号化 (暗号文と初期化ベクトルを取得)
      const { ciphertext, iv } = await window.SecureCrypto.encryptData(textToEncrypt, key);

      // 3. 鍵をURLセーフなBase64文字列にエクスポート
      const keyBase64 = await window.SecureCrypto.exportKey(key);

      // 4. バックエンドAPI (POST /api/secret) への送信
      const payload = {
        ciphertext,
        iv,
        content_type: activeMode,
        ttl_seconds: parseInt(selectExpire.value, 10),
        turnstile_token: turnstileToken,
      };

      const response = await fetch('/api/secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 403) {
          throw new Error('ボット防止認証（Turnstile）に失敗しました。もう一度チェックをやり直してください。');
        }
        throw new Error(errData.error || `シークレットの発行に失敗しました (HTTP ${response.status})`);
      }

      const data = await response.json();
      const secretId = data.id;

      // 5. ゼロナレッジ受取用URLの構築 (ハッシュフラグメントに暗号鍵を格納)
      // 形式: https://<domain>/view.html?id=<secretId>#<keyBase64>
      const viewUrl = new URL('view.html', window.location.href);
      viewUrl.searchParams.set('id', secretId);
      viewUrl.hash = keyBase64;

      generatedUrlInput.value = viewUrl.toString();
      resultBox.style.display = 'block';
      secretForm.style.display = 'none';

      // 自動でURL入力欄を選択
      generatedUrlInput.select();

    } catch (err) {
      console.error('シークレット発行エラー:', err);
      alert(err.message);
      // Turnstileウィジェットをリセットして再試行可能にする
      if (window.turnstile) {
        window.turnstile.reset();
      }
    } finally {
      btnCreate.disabled = false;
      btnCreate.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        暗号化してワンタイムリンクを発行
      `;
    }
  });

  // URLコピーボタン
  btnCopyUrl.addEventListener('click', async () => {
    if (!generatedUrlInput.value) return;
    try {
      await navigator.clipboard.writeText(generatedUrlInput.value);
      showToast('ワンタイムURLをコピーしました！');
    } catch {
      generatedUrlInput.select();
      document.execCommand('copy');
      showToast('ワンタイムURLをコピーしました！');
    }
  });

  // 別のシークレットを作成（フォームのリセット）
  btnReset.addEventListener('click', () => {
    inputPassword.value = '';
    inputNote.value = '';
    resultBox.style.display = 'none';
    secretForm.style.display = 'block';
    // Turnstileウィジェットをリセット
    if (window.turnstile) {
      window.turnstile.reset();
    }
  });
});
