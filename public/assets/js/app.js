/**
 * SecureShare - 作成画面UIロジック (app.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  // 要素の取得
  const tabPassword = document.getElementById('tab-password');
  const tabNote = document.getElementById('tab-note');
  const tabImage = document.getElementById('tab-image');

  const groupPassword = document.getElementById('group-password');
  const groupNote = document.getElementById('group-note');
  const groupImage = document.getElementById('group-image');

  const inputPassword = document.getElementById('input-password');
  const inputNote = document.getElementById('input-note');

  // 画像アップローダー要素
  const inputImageFile = document.getElementById('input-image-file');
  const imageDropZone = document.getElementById('image-drop-zone');
  const imagePreviewCard = document.getElementById('image-preview-card');
  const imagePreviewThumb = document.getElementById('image-preview-thumb');
  const imagePreviewName = document.getElementById('image-preview-name');
  const imagePreviewSize = document.getElementById('image-preview-size');
  const imagePreviewType = document.getElementById('image-preview-type');
  const btnRemoveImage = document.getElementById('btn-remove-image');
  let selectedImageFile = null;

  const cardModeBurn = document.getElementById('card-mode-burn');
  const cardModeRetain = document.getElementById('card-mode-retain');
  const radioBurnModes = document.querySelectorAll('input[name="burn_mode"]');

  const selectExpire = document.getElementById('select-expire');
  const groupCustomDays = document.getElementById('group-custom-days');
  const inputCustomDays = document.getElementById('input-custom-days');

  const secretForm = document.getElementById('secret-form');
  const btnCreate = document.getElementById('btn-create');
  const resultBox = document.getElementById('result-box');
  const resultTitle = document.getElementById('result-title');
  const resultDesc = document.getElementById('result-desc');
  const generatedUrlInput = document.getElementById('generated-url');
  const btnCopyUrl = document.getElementById('btn-copy-url');
  const btnReset = document.getElementById('btn-reset');
  const toast = document.getElementById('toast');

  let activeMode = 'password'; // 'password', 'note', 'image'

  // トースト表示関数
  function showToast(message = 'クリップボードにコピーしました') {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // 有効期限のオプション切り替え（通常用: 最大30日 / 画像用: 最大8日）
  function updateExpireOptions(isImageMode) {
    const currentValue = selectExpire.value;
    if (isImageMode) {
      selectExpire.innerHTML = `
        <option value="3600">1時間後</option>
        <option value="86400" selected>24時間後 (1日)</option>
        <option value="259200">3日後</option>
        <option value="604800">7日後 (1週間)</option>
        <option value="691200">8日後 (最長)</option>
        <option value="custom">日数を直接指定（カスタム: 最大8日）</option>
      `;
      inputCustomDays.max = '8';
      if (parseInt(inputCustomDays.value, 10) > 8) {
        inputCustomDays.value = '8';
      }
    } else {
      selectExpire.innerHTML = `
        <option value="3600">1時間後</option>
        <option value="86400" selected>24時間後 (1日)</option>
        <option value="259200">3日後</option>
        <option value="604800">7日後</option>
        <option value="1209600">14日後 (2週間)</option>
        <option value="2592000">30日後 (最長)</option>
        <option value="custom">日数を直接指定（カスタム: 最大30日）</option>
      `;
      inputCustomDays.max = '30';
    }

    // 保持できる値があれば維持
    if (selectExpire.querySelector(`option[value="${currentValue}"]`)) {
      selectExpire.value = currentValue;
    } else {
      selectExpire.value = '86400';
    }

    if (selectExpire.value === 'custom') {
      groupCustomDays.style.display = 'block';
    } else {
      groupCustomDays.style.display = 'none';
    }
  }

  // タブ切り替え処理
  function switchTab(mode) {
    activeMode = mode;
    tabPassword.classList.toggle('active', mode === 'password');
    tabPassword.setAttribute('aria-selected', mode === 'password');

    tabNote.classList.toggle('active', mode === 'note');
    tabNote.setAttribute('aria-selected', mode === 'note');

    if (tabImage) {
      tabImage.classList.toggle('active', mode === 'image');
      tabImage.setAttribute('aria-selected', mode === 'image');
    }

    groupPassword.style.display = mode === 'password' ? 'block' : 'none';
    groupNote.style.display = mode === 'note' ? 'block' : 'none';
    groupImage.style.display = mode === 'image' ? 'block' : 'none';

    // 有効期限のオプション切り替え（画像は最長8日ポリシー）
    updateExpireOptions(mode === 'image');
  }

  tabPassword.addEventListener('click', () => switchTab('password'));
  tabNote.addEventListener('click', () => switchTab('note'));
  if (tabImage) {
    tabImage.addEventListener('click', () => switchTab('image'));
  }

  // 画像ファイル選択・ドラッグ＆ドロップ処理
  function handleImageFile(file) {
    if (!file) return;

    // MIMEタイプ検証
    if (!file.type.startsWith('image/')) {
      alert('画像ファイル（PNG, JPEG, WebP, GIF など）を選択してください。');
      return;
    }

    // 容量制限: 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert('画像ファイルのサイズは10MB以内である必要があります。');
      return;
    }

    selectedImageFile = file;

    // プレビュー表示
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreviewThumb.src = e.target.result;
      imagePreviewName.textContent = file.name;
      const sizeKB = (file.size / 1024).toFixed(1);
      const sizeText = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
        : `${sizeKB} KB`;
      imagePreviewSize.textContent = sizeText;
      imagePreviewType.textContent = file.type || 'image';

      imageDropZone.style.display = 'none';
      imagePreviewCard.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  }

  function resetImageSelection() {
    selectedImageFile = null;
    inputImageFile.value = '';
    imagePreviewThumb.src = '';
    imageDropZone.style.display = 'block';
    imagePreviewCard.style.display = 'none';
  }

  if (imageDropZone) {
    imageDropZone.addEventListener('click', () => inputImageFile.click());

    imageDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      imageDropZone.classList.add('dragover');
    });

    imageDropZone.addEventListener('dragleave', () => {
      imageDropZone.classList.remove('dragover');
    });

    imageDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      imageDropZone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleImageFile(e.dataTransfer.files[0]);
      }
    });
  }

  if (inputImageFile) {
    inputImageFile.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleImageFile(e.target.files[0]);
      }
    });
  }

  if (btnRemoveImage) {
    btnRemoveImage.addEventListener('click', resetImageSelection);
  }

  // 消去モード切り替え時のUI更新
  function updateBurnModeUI() {
    const selectedMode = document.querySelector('input[name="burn_mode"]:checked')?.value || '1';
    if (selectedMode === '1') {
      cardModeBurn.style.background = 'rgba(16, 185, 129, 0.1)';
      cardModeBurn.style.borderColor = 'var(--accent-primary)';
      cardModeRetain.style.background = 'rgba(0, 0, 0, 0.25)';
      cardModeRetain.style.borderColor = 'var(--border-color)';
      btnCreate.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        暗号化してワンタイムリンクを発行
      `;
    } else {
      cardModeRetain.style.background = 'rgba(6, 182, 212, 0.1)';
      cardModeRetain.style.borderColor = 'var(--accent-cyan)';
      cardModeBurn.style.background = 'rgba(0, 0, 0, 0.25)';
      cardModeBurn.style.borderColor = 'var(--border-color)';
      btnCreate.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        暗号化してセキュアリンクを発行
      `;
    }
  }

  radioBurnModes.forEach(radio => {
    radio.addEventListener('change', updateBurnModeUI);
  });

  // 有効期限セレクタの変更時（カスタム日数表示切り替え）
  selectExpire.addEventListener('change', () => {
    if (selectExpire.value === 'custom') {
      groupCustomDays.style.display = 'block';
    } else {
      groupCustomDays.style.display = 'none';
    }
  });

  // フォーム送信（暗号化およびリンク発行）
  secretForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 入力検証
    if (activeMode === 'image') {
      if (!selectedImageFile) {
        alert('共有する画像ファイルを選択してください。');
        return;
      }
    } else {
      const textToEncrypt = activeMode === 'password' ? inputPassword.value.trim() : inputNote.value.trim();
      if (!textToEncrypt) {
        alert('共有するパスワードまたは秘密メモを入力してください。');
        return;
      }
    }

    // Turnstile トークンの取得
    const turnstileContainer = document.querySelector('.cf-turnstile');
    const turnstileToken = window.turnstile ? window.turnstile.getResponse() : null;
    if (turnstileContainer && window.turnstile && !turnstileToken) {
      alert('ボット防止認証（Turnstile）のチェックを完了してください。');
      return;
    }

    // 秒数の計算
    let ttlSeconds = 86400;
    const maxCustomDays = activeMode === 'image' ? 8 : 30;
    if (selectExpire.value === 'custom') {
      const days = Math.min(maxCustomDays, Math.max(1, parseInt(inputCustomDays.value, 10) || 1));
      ttlSeconds = days * 86400;
    } else {
      ttlSeconds = parseInt(selectExpire.value, 10);
    }

    // 消去モード (1: ワンタイム即座消去, 0: 期限まで保持)
    const selectedBurnMode = document.querySelector('input[name="burn_mode"]:checked')?.value || '1';
    const burnAfterRead = parseInt(selectedBurnMode, 10);

    btnCreate.disabled = true;
    btnCreate.textContent = activeMode === 'image' ? '画像を暗号化してアップロード中...' : '暗号化して発行中...';

    try {
      // 1. クライアント側でランダムなAES-GCM暗号鍵を生成
      const key = await window.SecureCrypto.generateAesKey();

      // 2. 鍵をURLセーフなBase64文字列にエクスポート
      const keyBase64 = await window.SecureCrypto.exportKey(key);

      let recordId = '';
      let expiresAtTimestamp = 0;

      if (activeMode === 'image') {
        // --- 画像アップロード処理 ---
        const arrayBuffer = await selectedImageFile.arrayBuffer();
        const { encryptedBuffer, iv } = await window.SecureCrypto.encryptBinary(arrayBuffer, key);

        const formData = new FormData();
        const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
        formData.append('file', encryptedBlob, 'encrypted_image.bin');
        formData.append('iv', iv);
        formData.append('mime_type', selectedImageFile.type || 'image/png');
        formData.append('ttl_seconds', String(ttlSeconds));
        formData.append('burn_after_read', String(burnAfterRead));
        if (turnstileToken) {
          formData.append('turnstile_token', turnstileToken);
        }

        const response = await fetch('/api/image', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          if (response.status === 403) {
            throw new Error('ボット防止認証（Turnstile）に失敗しました。もう一度チェックをやり直してください。');
          }
          throw new Error(errData.error || `画像の発行に失敗しました (HTTP ${response.status})`);
        }

        const data = await response.json();
        recordId = data.id;
        expiresAtTimestamp = data.expires_at;

      } else {
        // --- テキスト/パスワード処理 ---
        const textToEncrypt = activeMode === 'password' ? inputPassword.value.trim() : inputNote.value.trim();
        const { ciphertext, iv } = await window.SecureCrypto.encryptData(textToEncrypt, key);

        const payload = {
          ciphertext,
          iv,
          content_type: activeMode,
          ttl_seconds: ttlSeconds,
          turnstile_token: turnstileToken,
          burn_after_read: burnAfterRead,
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
        recordId = data.id;
        expiresAtTimestamp = data.expires_at;
      }

      // 3. ゼロナレッジ受取用URLの構築 (ハッシュフラグメントに暗号鍵を格納)
      // 形式: https://<domain>/view.html?id=<recordId>(&type=image)(&burn=0)#<keyBase64>
      const viewUrl = new URL('view.html', window.location.href);
      viewUrl.searchParams.set('id', recordId);
      if (activeMode === 'image') {
        viewUrl.searchParams.set('type', 'image');
      }
      if (burnAfterRead === 0) {
        viewUrl.searchParams.set('burn', '0');
      }
      viewUrl.hash = keyBase64;

      generatedUrlInput.value = viewUrl.toString();

      // 発行結果メッセージの更新
      if (burnAfterRead === 1) {
        resultTitle.textContent = '✓ ワンタイムリンクが発行されました';
        resultDesc.textContent = 'このリンクは1度開かれると自動的に消去されます。相手に安全に伝達してください。';
      } else {
        const expireDateStr = new Date(expiresAtTimestamp).toLocaleString('ja-JP');
        resultTitle.textContent = '✓ 期限保持リンクが発行されました';
        resultDesc.textContent = `このリンクは有効期限（${expireDateStr}まで）何度でもアクセス可能です。`;
      }

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
      updateBurnModeUI();
    }
  });

  // URLコピーボタン
  btnCopyUrl.addEventListener('click', async () => {
    if (!generatedUrlInput.value) return;
    try {
      await navigator.clipboard.writeText(generatedUrlInput.value);
      showToast('URLをコピーしました！');
    } catch {
      generatedUrlInput.select();
      document.execCommand('copy');
      showToast('URLをコピーしました！');
    }
  });

  // 別のシークレットを作成（フォームのリセット）
  btnReset.addEventListener('click', () => {
    inputPassword.value = '';
    inputNote.value = '';
    resetImageSelection();
    resultBox.style.display = 'none';
    secretForm.style.display = 'block';
    // Turnstileウィジェットをリセット
    if (window.turnstile) {
      window.turnstile.reset();
    }
  });
});
