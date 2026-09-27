/**
 * プライバシーポリシーモーダル制御スクリプト
 */
(function() {
  document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('privacy-modal');
    const openBtn = document.getElementById('btn-open-privacy');
    const closeBtn = document.getElementById('btn-close-privacy');
    const closeFooterBtn = document.getElementById('btn-close-privacy-footer');

    if (!modal || !openBtn) return;

    // モーダルを開く
    function openModal() {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      // 閉じるボタンにフォーカスを移動
      if (closeBtn) closeBtn.focus();
    }

    // モーダルを閉じる
    function closeModal() {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (openBtn) openBtn.focus();
    }

    // イベントリスナーの登録
    openBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    if (closeFooterBtn) {
      closeFooterBtn.addEventListener('click', closeModal);
    }

    // 背景オーバーレイのクリックで閉じる
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Escキー押下で閉じる
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
      }
    });
  });
})();
