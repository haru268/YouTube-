/**
 * ロガーユーティリティ
 * 本番環境では適切なログライブラリ（winston等）を使用することを推奨
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const currentLogLevel = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO
  : LOG_LEVELS.INFO;

/**
 * エラーログ
 * @param {string} message - ログメッセージ
 * @param {Error|object} error - エラーオブジェクト
 */
function logError(message, error = null) {
  if (currentLogLevel >= LOG_LEVELS.ERROR) {
    console.error(`[ERROR] ${message}`, error ? error.stack || error : '');
  }
}

/**
 * 警告ログ
 * @param {string} message - ログメッセージ
 */
function logWarn(message) {
  if (currentLogLevel >= LOG_LEVELS.WARN) {
    console.warn(`[WARN] ${message}`);
  }
}

/**
 * 情報ログ
 * @param {string} message - ログメッセージ
 */
function logInfo(message) {
  if (currentLogLevel >= LOG_LEVELS.INFO) {
    console.log(`[INFO] ${message}`);
  }
}

/**
 * デバッグログ
 * @param {string} message - ログメッセージ
 * @param {any} data - 追加データ
 */
function logDebug(message, data = null) {
  if (currentLogLevel >= LOG_LEVELS.DEBUG) {
    console.log(`[DEBUG] ${message}`, data || '');
  }
}

module.exports = {
  logError,
  logWarn,
  logInfo,
  logDebug,
  LOG_LEVELS
};

