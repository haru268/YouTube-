// 共通関数

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return num.toLocaleString('ja-JP');
}

function showMessage(element, message, type = 'success') {
  element.textContent = message;
  element.className = `message ${type}`;
  element.style.display = 'block';
  setTimeout(() => {
    element.style.display = 'none';
  }, 3000);
}

function showError(element, message) {
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => {
    element.classList.remove('show');
  }, 5000);
}

// ローディング状態の表示
function showLoading(element, text = '処理中...') {
  // グローバルローディングオーバーレイの表示
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  if (loadingOverlay) {
    if (loadingText) {
      loadingText.textContent = text;
    }
    loadingOverlay.classList.add('show');
  }
  
  // ボタンのローディング状態
  if (element) {
    element.disabled = true;
    element.dataset.originalText = element.textContent;
    element.classList.add('loading');
    if (text && !loadingOverlay) {
      // オーバーレイがない場合のみボタンテキストを変更
      element.textContent = text;
    }
  }
}

function hideLoading(element) {
  // グローバルローディングオーバーレイの非表示
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.classList.remove('show');
  }
  
  // ボタンのローディング状態解除
  if (element && element.dataset.originalText) {
    element.disabled = false;
    element.classList.remove('loading');
    element.textContent = element.dataset.originalText;
    delete element.dataset.originalText;
  }
}

// ページ全体のローディングオーバーレイ
function showPageLoading() {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.id = 'pageLoadingOverlay';
  overlay.innerHTML = '<div class="spinner-large"></div>';
  document.body.appendChild(overlay);
}

function hidePageLoading() {
  const overlay = document.getElementById('pageLoadingOverlay');
  if (overlay) {
    overlay.remove();
  }
}

// 削除確認モーダル
function showDeleteConfirm(message, onConfirm, onCancel) {
  const modal = document.createElement('div');
  modal.className = 'modal show';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 400px;">
      <div class="modal-header">
        <h3>確認</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom: 1.5rem; color: #333333;">${message}</p>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">キャンセル</button>
          <button type="button" class="btn btn-danger" id="confirmDeleteBtn">削除</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  const confirmBtn = modal.querySelector('#confirmDeleteBtn');
  const cancelBtn = modal.querySelector('.btn-secondary');
  
  confirmBtn.addEventListener('click', () => {
    modal.remove();
    if (onConfirm) onConfirm();
  });
  
  cancelBtn.addEventListener('click', () => {
    modal.remove();
    if (onCancel) onCancel();
  });
  
  // モーダル背景クリックで閉じる
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
      if (onCancel) onCancel();
    }
  });
}

// 成功メッセージの表示（ダイアログ形式）
function showSuccessMessage(message) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; z-index: 10000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center;';
  
  const closeModal = () => {
    modal.remove();
  };
  
  modal.innerHTML = `
    <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid #e0e0e0;">
        <h3 style="font-size: 1.3rem; color: #2e7d32; margin: 0;">✓ 成功</h3>
        <button id="closeBtn" style="background: none; border: none; color: #666666; font-size: 1.5rem; cursor: pointer; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: background-color 0.2s;" aria-label="閉じる" onmouseover="this.style.backgroundColor='#e0e0e0'" onmouseout="this.style.backgroundColor='transparent'">&times;</button>
      </div>
      <div style="padding: 1.5rem;">
        <p style="margin-bottom: 1.5rem; color: #333333; white-space: pre-line; line-height: 1.6;">${escapeHtml(message)}</p>
        <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #e0e0e0;">
          <button type="button" id="okBtn" class="btn btn-primary">OK</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // 閉じるボタンのイベント
  const closeBtn = modal.querySelector('#closeBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }
  
  // OKボタンのイベント
  const okBtn = modal.querySelector('#okBtn');
  if (okBtn) {
    okBtn.addEventListener('click', closeModal);
    setTimeout(() => okBtn.focus(), 100);
    okBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        closeModal();
      }
    });
  }
  
  // モーダル背景クリックで閉じる
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

// エラーメッセージの表示（ダイアログ形式）
function showErrorMessage(message) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; z-index: 10000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center;';
  
  const closeModal = () => {
    modal.remove();
  };
  
  modal.innerHTML = `
    <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid #e0e0e0;">
        <h3 style="font-size: 1.3rem; color: #c62828; margin: 0;">⚠ エラー</h3>
        <button id="closeBtn" style="background: none; border: none; color: #666666; font-size: 1.5rem; cursor: pointer; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: background-color 0.2s;" aria-label="閉じる" onmouseover="this.style.backgroundColor='#e0e0e0'" onmouseout="this.style.backgroundColor='transparent'">&times;</button>
      </div>
      <div style="padding: 1.5rem;">
        <p style="margin-bottom: 1.5rem; color: #333333; white-space: pre-line; line-height: 1.6;">${escapeHtml(message)}</p>
        <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #e0e0e0;">
          <button type="button" id="okBtn" class="btn btn-primary">OK</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // 閉じるボタンのイベント
  const closeBtn = modal.querySelector('#closeBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }
  
  // OKボタンのイベント
  const okBtn = modal.querySelector('#okBtn');
  if (okBtn) {
    okBtn.addEventListener('click', closeModal);
    setTimeout(() => okBtn.focus(), 100);
    okBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        closeModal();
      }
    });
  }
  
  // モーダル背景クリックで閉じる
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

// HTMLエスケープ関数（メッセージ表示用）
/**
 * HTMLエスケープ関数（XSS対策）
 * @param {string} text - エスケープするテキスト
 * @returns {string} エスケープされたHTML
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const str = String(text);
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * URLを安全にエスケープ
 * @param {string} url - エスケープするURL
 * @returns {string} エスケープされたURL
 */
function escapeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const urlObj = new URL(url);
    // 許可されたプロトコルのみ
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return '';
    }
    return url;
  } catch {
    return '';
  }
}

// ログアウトボタンのイベント設定
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
});

