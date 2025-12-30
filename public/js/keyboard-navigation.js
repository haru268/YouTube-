/**
 * キーボードナビゲーション支援
 */

/**
 * モーダルを開く際のフォーカス管理
 * @param {HTMLElement} modal - モーダル要素
 * @param {HTMLElement} firstInput - 最初にフォーカスする要素
 */
function setupModalFocus(modal, firstInput = null) {
  if (!modal) return;

  // モーダル内の最初の入力欄またはボタンにフォーカス
  const focusableElements = modal.querySelectorAll(
    'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  
  const firstElement = firstInput || focusableElements[0];
  if (firstElement) {
    setTimeout(() => {
      firstElement.focus();
    }, 100);
  }

  // ESCキーでモーダルを閉じる
  const handleEscape = (e) => {
    if (e.key === 'Escape' || e.keyCode === 27) {
      const closeBtn = modal.querySelector('.modal-close, [data-close-modal]');
      if (closeBtn) {
        closeBtn.click();
      }
    }
  };

  modal.addEventListener('keydown', handleEscape);
  modal.dataset.escapeHandler = 'true';

  // フォーカストラップ: モーダル内でフォーカスを維持
  const handleTab = (e) => {
    if (e.key !== 'Tab') return;

    const focusableElements = Array.from(modal.querySelectorAll(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  modal.addEventListener('keydown', handleTab);
}

/**
 * 検索入力のデバウンス処理
 * @param {Function} callback - 実行するコールバック関数
 * @param {number} delay - 遅延時間（ミリ秒）
 * @returns {Function} デバウンスされた関数
 */
function debounce(callback, delay = 300) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback.apply(this, args);
    }, delay);
  };
}

/**
 * フォームのリアルタイムバリデーション
 * @param {HTMLInputElement} input - 入力要素
 * @param {Function} validator - バリデーション関数
 */
function setupInputValidation(input, validator) {
  if (!input || !validator) return;

  const formGroup = input.closest('.form-group');
  if (!formGroup) return;

  let errorElement = formGroup.querySelector('.input-error');
  if (!errorElement) {
    errorElement = document.createElement('div');
    errorElement.className = 'input-error';
    errorElement.style.cssText = 'color: #d32f2f; font-size: 0.85rem; margin-top: 0.25rem; display: none;';
    formGroup.appendChild(errorElement);
  }

  const validate = () => {
    const error = validator(input.value);
    if (error) {
      input.style.borderColor = '#d32f2f';
      errorElement.textContent = error;
      errorElement.style.display = 'block';
      return false;
    } else {
      input.style.borderColor = '#e0e0e0';
      errorElement.style.display = 'none';
      return true;
    }
  };

  input.addEventListener('blur', validate);
  input.addEventListener('input', () => {
    if (input.value.trim() !== '') {
      validate();
    } else {
      input.style.borderColor = '#e0e0e0';
      errorElement.style.display = 'none';
    }
  });
}

