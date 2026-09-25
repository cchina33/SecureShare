/**
 * SecureShare - 閲覧・復号画面UIロジック (view.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  const stateConfirm = document.getElementById('state-confirm');
  const stateRevealed = document.getElementById('state-revealed');
  const stateError = document.getElementById('state-error');
  const errorMessage = document.getElementById('error-message');
  const btnReveal = document.getElementById('btn-reveal');

  // テキスト用要素
  const revealedTextContainer = document.getElementById('revealed-text-container');
  const revealedText = document.getElementById('revealed-text');
  const btnCopySecret = document.getElementById('btn-copy-secret');

  // 画像用要素
  const revealedImageContainer = document.getElementById('revealed-image-container');
  const revealedImage = document.getElementById('revealed-image');
  const btnDownloadImage = document.getElementById('btn-download-image');
  const btnOpenImageTab = document.getElementById('btn-open-image-tab');

  const revealedTitle = document.getElementById('revealed-title');
  const revealedDesc = document.getElementById('revealed-desc');
  const toast = document.getElementById('toast');

  // トースト表示関数
  function showToast(message = 'クリップボードにコピーしました') {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  const viewTitle = document.getElementById('view-title');
  const viewDesc = document.getElementById('view-desc');
  const warningBox = document.getElementById('warning-box');
  const warningTitleText = document.getElementById('warning-title-text');
  const warningText = document.getElementById('warning-text');

  // URLから ID、暗号鍵（ハッシュ）、消去モード、タイプを取得
  const currentUrl = new URL(window.location.href);
  const secretId = currentUrl.searchParams.get('id');
  const keyBase64 = currentUrl.hash.replace(/^#/, ''); // 先頭の # を除去
  const burnParam = currentUrl.searchParams.get('burn');
  const isRetainMode = burnParam === '0';
  const isImageMode = currentUrl.searchParams.get('type') === 'image';

  // 初期UIの文言切り替え（画像 or テキスト、期限保持 or ワンタイム）
  if (isImageMode) {
    if (viewTitle) viewTitle.textContent = isRetainMode ? 'セキュア画像を受信しました' : 'ワンタイム画像を受信しました';
    if (viewDesc) viewDesc.textContent = isRetainMode
      ? '暗号化された画像データが安全に共有されています。'
      : 'この画像は、閲覧すると直ちにサーバー上から完全消去されます。';
    if (btnReveal) {
      btnReveal.textContent = isRetainMode ? '画像を表示する' : '画像を表示して破棄する';
    }
  }

  if (isRetainMode) {
    if (!isImageMode && viewTitle) viewTitle.textContent = 'セキュアシークレットを受信しました';
    if (!isImageMode && viewDesc) viewDesc.textContent = '暗号化されたデータが安全に共有されています。';
    if (warningBox) {
      warningBox.style.background = 'rgba(6, 182, 212, 0.1)';
      warningBox.style.borderColor = 'rgba(6, 182, 212, 0.3)';
      warningBox.style.color = '#a5f3fc';
    }
    if (warningTitleText) warningTitleText.textContent = '有効期限内なら何度でも再閲覧可能';
    if (warningText) {
      warningText.textContent = isImageMode
        ? 'この画像は有効期限が切れるまで、同じリンクから何度でもご確認いただけます。'
        : 'このシークレットは有効期限が切れるまで、同じリンクから何度でもご確認いただけます。';
    }
    if (btnReveal) {
      btnReveal.className = 'btn-primary';
    }
  }

  // エラー画面表示ヘルパー
  function showError(msg) {
    if (msg) errorMessage.textContent = msg;
    stateConfirm.style.display = 'none';
    stateRevealed.style.display = 'none';
    stateError.style.display = 'block';
  }

  // パラメータ・暗号鍵の存在チェック
  if (!secretId || !keyBase64) {
    showError('無効なURLです。IDまたは復号鍵が欠落しています。');
    return;
  }

  // MIMEタイプから拡張子を取得するヘルパー
  function getExtensionFromMime(mime) {
    switch (mime) {
      case 'image/jpeg': return 'jpg';
      case 'image/png': return 'png';
      case 'image/webp': return 'webp';
      case 'image/gif': return 'gif';
      case 'image/svg+xml': return 'svg';
      default: return 'png';
    }
  }

  // 「表示する」ボタンのクリック処理
  btnReveal.addEventListener('click', async () => {
    btnReveal.disabled = true;
    btnReveal.textContent = isRetainMode ? '復号処理中...' : '復号および破棄処理中...';

    try {
      // 復号鍵をインポート
      const key = await window.SecureCrypto.importKey(keyBase64);

      if (isImageMode) {
        // --- 画像復号処理 ---
        const response = await fetch(`/api/image/${encodeURIComponent(secretId)}`);
        if (response.status === 404) {
          showError('この画像は既に閲覧されたか、有効期限が切れています。');
          return;
        }
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          showError(errData.error || '暗号化画像の取得に失敗しました。');
          return;
        }

        const iv = response.headers.get('X-Iv');
        const mimeType = response.headers.get('X-Mime-Type') || 'image/png';
        const burnAfterRead = parseInt(response.headers.get('X-Burn-After-Read') || '1', 10);
        const expiresAt = parseInt(response.headers.get('X-Expires-At') || '0', 10);

        if (!iv) {
          showError('暗号化メタデータ (IV) が取得できませんでした。');
          return;
        }

        const encryptedBuffer = await response.arrayBuffer();
        const decryptedBuffer = await window.SecureCrypto.decryptBinary(encryptedBuffer, iv, key);

        const blob = new Blob([decryptedBuffer], { type: mimeType });
        const objectUrl = URL.createObjectURL(blob);

        revealedImage.src = objectUrl;
        btnDownloadImage.href = objectUrl;
        const ext = getExtensionFromMime(mimeType);
        btnDownloadImage.download = `secureshare_${secretId.substring(0, 8)}.${ext}`;
        btnOpenImageTab.href = objectUrl;

        revealedTitle.textContent = '復号された画像';
        revealedTextContainer.style.display = 'none';
        revealedImageContainer.style.display = 'block';

        if (burnAfterRead === 1) {
          revealedDesc.textContent = '✓ サーバーからデータは永久に削除されました。必要な場合は今すぐ保存してください。';
          revealedDesc.style.color = 'var(--accent-danger)';
          history.replaceState(null, '', window.location.pathname);
        } else {
          const expireStr = new Date(expiresAt).toLocaleString('ja-JP');
          revealedDesc.textContent = `✓ 復号に成功しました。この画像は有効期限（${expireStr}まで）何度でも閲覧できます。`;
          revealedDesc.style.color = 'var(--accent-cyan)';
        }

      } else {
        // --- テキスト復号処理 ---
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
        const burnAfterRead = data.burn_after_read ?? 1;

        const plainText = await window.SecureCrypto.decryptData(ciphertext, iv, key);

        revealedText.textContent = plainText;
        revealedTitle.textContent = '復号されたシークレット';
        revealedTextContainer.style.display = 'block';
        revealedImageContainer.style.display = 'none';

        if (burnAfterRead === 1) {
          revealedDesc.textContent = '✓ サーバーからデータは永久に削除されました。必要な場合は今すぐコピーしてください。';
          revealedDesc.style.color = 'var(--accent-danger)';
          history.replaceState(null, '', window.location.pathname);
        } else {
          const expireStr = new Date(data.expires_at).toLocaleString('ja-JP');
          revealedDesc.textContent = `✓ 復号に成功しました。このシークレットは有効期限（${expireStr}まで）何度でも閲覧できます。`;
          revealedDesc.style.color = 'var(--accent-cyan)';
        }
      }

      stateConfirm.style.display = 'none';
      stateRevealed.style.display = 'block';

    } catch (err) {
      console.error('復号処理に失敗しました:', err);
      showError('復号に失敗しました。復号鍵が正しくないか、データが破損しています。');
    }
  });

  // 復号されたシークレットのコピー機能
  if (btnCopySecret) {
    btnCopySecret.addEventListener('click', async () => {
      if (!revealedText.textContent) return;
      try {
        await navigator.clipboard.writeText(revealedText.textContent);
        showToast('内容をコピーしました！');
      } catch {
        const textarea = document.createElement('textarea');
        textarea.value = revealedText.textContent;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('内容をコピーしました！');
      }
    });
  }
});
