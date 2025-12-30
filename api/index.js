// Vercel serverless function handler
let app = null;

module.exports = async (req, res) => {
  try {
    // アプリがまだ読み込まれていない場合は読み込む
    if (!app) {
      // 動的にappを読み込む（エラーをキャッチするため）
      app = require('../server.js');
    }
    
    // Expressアプリケーションにリクエストを渡す
    // Vercel環境では、データベース初期化はミドルウェアで自動的に行われる
    return app(req, res);
  } catch (error) {
    console.error('Request handling error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request URL:', req.url);
    console.error('Request method:', req.method);
    console.error('Vercel environment:', !!process.env.VERCEL);
    console.error('Node environment:', process.env.NODE_ENV);
    
    // エラーが発生した場合、appをリセットして次回のリクエストで再試行できるようにする
    app = null;
    
    // レスポンスがまだ送信されていない場合のみエラーを送信
    if (!res.headersSent) {
      res.status(500).json({
        error: 'サーバーの初期化に失敗しました',
        message: error.message,
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

