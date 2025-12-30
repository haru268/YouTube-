// Vercel serverless function handler
let app = null;
let initError = null;
let initPromise = null;

// 未処理の例外をキャッチ（起動時のクラッシュを防ぐ）
process.on('uncaughtException', (error) => {
  console.error('=== UNCAUGHT EXCEPTION ===');
  console.error('Error name:', error.name);
  console.error('Error message:', error.message);
  console.error('Error code:', error.code);
  console.error('Error stack:', error.stack);
  initError = error;
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('=== UNHANDLED REJECTION ===');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  if (reason instanceof Error) {
    console.error('Error stack:', reason.stack);
  }
});

async function initializeApp() {
  if (app) {
    return app;
  }
  
  if (initPromise) {
    return initPromise;
  }
  
  initPromise = (async () => {
    try {
      console.log('=== Starting app initialization ===');
      console.log('Vercel environment:', !!process.env.VERCEL);
      console.log('Node environment:', process.env.NODE_ENV);
      console.log('Node version:', process.version);
      console.log('Current working directory:', process.cwd());
      console.log('__dirname equivalent:', __dirname);
      
      // モジュールの読み込みを試行
      console.log('Loading server.js...');
      
      // 各モジュールを個別に読み込んでエラーを特定
      try {
        console.log('Loading express...');
        require('express');
        console.log('express loaded');
      } catch (e) {
        console.error('Failed to load express:', e);
        throw e;
      }
      
      try {
        console.log('Loading sqlite3...');
        require('sqlite3');
        console.log('sqlite3 loaded');
      } catch (e) {
        console.error('Failed to load sqlite3:', e);
        throw e;
      }
      
      try {
        console.log('Loading server.js module...');
        app = require('../server.js');
        console.log('Server.js loaded successfully');
      } catch (loadError) {
        console.error('Failed to load server.js:', loadError);
        console.error('Load error name:', loadError.name);
        console.error('Load error message:', loadError.message);
        console.error('Load error code:', loadError.code);
        console.error('Load error stack:', loadError.stack);
        throw loadError;
      }
      
      return app;
    } catch (error) {
      console.error('=== App initialization failed ===');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Error stack:', error.stack);
      
      // エラーの詳細情報を記録
      if (error.code === 'MODULE_NOT_FOUND') {
        console.error('Module not found. Check if all dependencies are installed.');
        console.error('Missing module path:', error.message);
      }
      if (error.message && error.message.includes('sqlite3')) {
        console.error('SQLite3 module error. This may be a native module compilation issue.');
      }
      
      initError = error;
      initPromise = null;
      throw error;
    }
  })();
  
  return initPromise;
}

module.exports = async (req, res) => {
  // 初期化エラーが既に発生している場合は、それを返す
  if (initError) {
    console.error('Using cached init error:', initError.message);
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'サーバーの初期化に失敗しました',
        message: initError.message,
        errorName: initError.name,
        errorCode: initError.code
      });
    }
    return;
  }

  try {
    // アプリの初期化を待つ
    const serverApp = await initializeApp();
    
    // Expressアプリケーションにリクエストを渡す
    // Vercel環境では、データベース初期化はミドルウェアで自動的に行われる
    return serverApp(req, res);
  } catch (error) {
    console.error('=== Request handling error ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
    console.error('Request URL:', req.url);
    console.error('Request method:', req.method);
    console.error('Vercel environment:', !!process.env.VERCEL);
    console.error('Node environment:', process.env.NODE_ENV);
    
    // 初期化エラーの場合はキャッシュ
    if (!app && !initError) {
      initError = error;
    }
    
    // レスポンスがまだ送信されていない場合のみエラーを送信
    if (!res.headersSent) {
      res.status(500).json({
        error: 'サーバーの初期化に失敗しました',
        message: error.message,
        errorName: error.name,
        errorCode: error.code,
        ...(process.env.NODE_ENV !== 'production' && { 
          stack: error.stack,
          details: {
            url: req.url,
            method: req.method,
            vercel: !!process.env.VERCEL
          }
        })
      });
    }
  }
};

