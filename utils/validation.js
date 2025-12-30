/**
 * 入力検証ユーティリティ
 */

/**
 * 文字列をサニタイズ（XSS対策）
 * @param {string} str - サニタイズする文字列
 * @returns {string} サニタイズされた文字列
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * ファイル名をサニタイズ
 * @param {string} filename - サニタイズするファイル名
 * @returns {string} サニタイズされたファイル名
 */
function sanitizeFilename(filename) {
  if (typeof filename !== 'string') return '';
  // 危険な文字を削除
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/\.\./g, '')
    .substring(0, 255); // ファイル名の最大長を制限
}

/**
 * 数値の検証
 * @param {any} value - 検証する値
 * @param {number} min - 最小値
 * @param {number} max - 最大値
 * @returns {boolean} 有効な数値かどうか
 */
function isValidNumber(value, min = -Infinity, max = Infinity) {
  const num = Number(value);
  return !isNaN(num) && num >= min && num <= max;
}

/**
 * 文字列の長さ検証
 * @param {string} str - 検証する文字列
 * @param {number} minLength - 最小長
 * @param {number} maxLength - 最大長
 * @returns {boolean} 有効な長さかどうか
 */
function isValidLength(str, minLength = 0, maxLength = Infinity) {
  if (typeof str !== 'string') return false;
  return str.length >= minLength && str.length <= maxLength;
}

/**
 * URLの検証
 * @param {string} url - 検証するURL
 * @returns {boolean} 有効なURLかどうか
 */
function isValidUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

/**
 * 日付文字列の検証
 * @param {string} dateString - 検証する日付文字列
 * @returns {boolean} 有効な日付かどうか
 */
function isValidDate(dateString) {
  if (typeof dateString !== 'string' || !dateString.trim()) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

module.exports = {
  sanitizeString,
  sanitizeFilename,
  isValidNumber,
  isValidLength,
  isValidUrl,
  isValidDate
};

