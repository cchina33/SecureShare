/**
 * SecureShare - 閲覧・復号画面UIロジック (view.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  const stateConfirm = document.getElementById('state-confirm');
  const stateRevealed = document.getElementById('state-revealed');
  const stateError = document.getElementById('state-error');
  const errorMessage = document.getElementById('error-message');
  const btnReveal = document.getElementById('btn-reveal');
  const revealedText = document.getElementById('revealed-text');
  const btnCopySecret = document.getElementById('btn-copy-secret');
  const toast = document.getElementById('toast');

  // トースト表示関数
  function showToast(message = 'クリップボードにコピーしました') {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // URLから ID と 暗号鍵（URLハッシュ）を取得
  const currentUrl = new URL(window.location.href);
  const secretId = currentUrl.searchParams.get('id');
  const keyBase64 = currentUrl.hash.replace(/^#/, ''); // 先頭の # を除去

  // エラー画面表示ヘルパー
  function showError(msg) {
    if (msg) errorMessage.textContent = msg;
    stateConfirm.style.display = 'none';
    stateRevealed.style.display = 'none';
    stateError.style.display = 'block';
  }

  // パラメータ・暗号鍵の存在チェック
  if (!secretId || !keyBase64) {
    showError('無効なURLです。シークレットIDまたは復号鍵が欠落しています。');
    return;
  }

  // 「シークレットを表示して破棄する」ボタンのクリック処理
  btnReveal.addEventListener('click', async () => {
    btnReveal.disabled = true;
    btnReveal.textContent = '復号および破棄処理中...';

    try {
      let ciphertext = '';
      let iv = '';

      // 1. Workers API (GET /api/secret/<id>) から暗号文を取得
      // ※ API側で取得と同時にD1から物理削除されます
      const response = await fetch(`/api/secret/${encodeURIComponent(secretId)}`);
      if (response.status === 404) {
        showError('このシークレットは既に閲覧されたか、有効期限が切れています。');
        return;
      }
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        showError(errData.error || '暗号文の取得に失敗しました。');
        return;
      }
      const data = await response.json();
      const ciphertext = data.ciphertext;
      const iv = data.iv;

      // 2. URLハッシュから暗号鍵をインポート
      const key = await window.SecureCrypto.importKey(keyBase64);

      // 3. クライアント側で復号
      const plainText = await window.SecureCrypto.decryptData(ciphertext, iv, key);

      // 4. 画面表示の切り替え
      revealedText.textContent = plainText;
      stateConfirm.style.display = 'none';
      stateRevealed.style.display = 'block';

      // セキュリティのため、ブラウザのアドレスバーからハッシュ（復号鍵）を除去
      history.replaceState(null, '', window.location.pathname);

    } catch (err) {
      console.error('復号処理に失敗しました:', err);
      showError('復号に失敗しました。復号鍵が正しくないか、データが破損しています。');
    }
  });

  // 復号されたシークレットのコピー機能
  btnCopySecret.addEventListener('click', async () => {
    if (!revealedText.textContent) return;
    try {
      await navigator.clipboard.writeText(revealedText.textContent);
      showToast('シークレットをコピーしました！');
    } catch {
      showToast('コピーに失敗しました。テキストを手動で選択してください。');
    }
  });
});
