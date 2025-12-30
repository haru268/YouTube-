require('dotenv').config();
const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const multer = require('multer');
const { logError, logWarn, logInfo, logDebug } = require('./utils/logger');
const { validateVideoPlan, validatePostedVideo } = require('./middleware/validation');

const app = express();
const PORT = process.env.PORT || 3000;
// Vercel環境では/tmpディレクトリのみ書き込み可能
// VERCEL環境変数が設定されている場合は/tmpを使用
const isVercel = !!process.env.VERCEL;
const DB_PATH = isVercel 
  ? path.join('/tmp', 'videos.db')
  : path.join(__dirname, 'videos.db');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const isProduction = process.env.NODE_ENV === 'production';

// Vercel環境では/tmpディレクトリが存在することを確認
if (isVercel) {
  const tmpDir = '/tmp';
  if (!fs.existsSync(tmpDir)) {
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
      logInfo('/tmpディレクトリを作成しました');
    } catch (err) {
      logError('/tmpディレクトリの作成に失敗しました:', err);
    }
  }
}

// 環境変数の検証
let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET === 'your-secret-key-change-this') {
  const errorMsg = '警告: SESSION_SECRETが設定されていません。Vercelの環境変数設定でSESSION_SECRETを設定してください。';
  console.warn(errorMsg);
  // 開発環境ではデフォルト値を使用（本番環境では使用しない）
  if (!isProduction && require.main === module) {
    SESSION_SECRET = 'dev-secret-key-change-in-production-' + Math.random().toString(36);
    console.warn('開発環境用の一時的なSESSION_SECRETが生成されました。本番環境では必ず設定してください。');
  } else if (isProduction || !require.main === module) {
    // 本番環境またはサーバーレス環境では、ランダムな値を生成（セッションはリクエスト間で保持されない）
    SESSION_SECRET = process.env.SESSION_SECRET || 'temp-secret-' + Date.now();
    logWarn('SESSION_SECRETが設定されていません。セッションが正しく機能しない可能性があります。');
  }
}

if (SESSION_SECRET && SESSION_SECRET.length < 32) {
  console.warn('警告: SESSION_SECRETは32文字以上にすることを推奨します。');
}

// アップロードディレクトリの作成
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// 画像アップロード設定の共通関数
function createMulterConfig(prefix) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      // ファイル名をサニタイズ（パストラバーサル対策）
      const sanitizedOriginalName = file.originalname
        .replace(/[^a-zA-Z0-9._-]/g, '')
        .replace(/\.\./g, '')
        .substring(0, 100);
      const ext = path.extname(sanitizedOriginalName) || path.extname(file.originalname);
      cb(null, `${prefix}-${uniqueSuffix}${ext}`);
    }
  });

  return multer({
    storage: storage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      
      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('画像ファイルのみアップロード可能です（jpeg, jpg, png, gif, webp）'));
      }
    }
  });
}

const upload = createMulterConfig('channel');
const uploadThumbnail = createMulterConfig('thumbnail');

// セッション設定
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: isProduction, // 本番環境ではHTTPS必須
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

// JSONペイロードのサイズ制限
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// セキュリティヘッダー
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.static('public'));

// データベース初期化の状態を追跡
let dbInitialized = false;
let dbInitPromise = null;

// データベース初期化関数
async function initDatabase() {
  // 既に初期化済みの場合はスキップ
  if (dbInitialized) {
    return;
  }
  
  // 既に初期化中の場合は待機
  if (dbInitPromise) {
    return dbInitPromise;
  }
  
  logInfo(`データベース初期化を開始します。パス: ${DB_PATH}, Vercel環境: ${isVercel}`);
  
  dbInitPromise = new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        logError('データベース接続エラー:', err);
        logError(`データベースパス: ${DB_PATH}`);
        logError(`Vercel環境: ${isVercel}`);
        logError(`エラー詳細: ${err.message}`);
        dbInitPromise = null;
        reject(err);
        return;
      }
      
      // テーブルが存在するかチェック
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
        if (err) {
          db.close();
          dbInitPromise = null;
          reject(err);
          return;
        }
        
        if (!row) {
          // テーブルが存在しない場合は作成
          logInfo('データベースを初期化しています...');
          db.serialize(() => {
            // ユーザーテーブル
            db.run(`
              CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `);
            
            // チャンネル設定テーブル
            db.run(`
              CREATE TABLE IF NOT EXISTS channel_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                channel_name TEXT NOT NULL,
                channel_url TEXT NOT NULL,
                channel_image_url TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `);
            
            // 動画予定テーブル
            db.run(`
              CREATE TABLE IF NOT EXISTS video_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                no INTEGER NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('動画', 'ショート')),
                title TEXT NOT NULL,
                intro_content TEXT,
                narration_content TEXT,
                tags TEXT,
                category TEXT,
                reminder_date DATETIME,
                is_posted INTEGER DEFAULT 0 CHECK(is_posted IN (0, 1)),
                posted_at DATETIME,
                draft_content TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `);
            
            // 投稿済み動画テーブル
            db.run(`
              CREATE TABLE IF NOT EXISTS posted_videos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                video_id TEXT UNIQUE,
                no INTEGER DEFAULT 0,
                title TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('動画', 'ショート')),
                published_at DATETIME,
                thumbnail_url TEXT,
                view_count INTEGER DEFAULT 0,
                like_count INTEGER DEFAULT 0,
                url TEXT,
                is_converted_to_video INTEGER DEFAULT 0 CHECK(is_converted_to_video IN (0, 1)),
                is_public INTEGER DEFAULT 1 CHECK(is_public IN (0, 1)),
                tags TEXT,
                category TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `);
            
            // テンプレートテーブル
            db.run(`
              CREATE TABLE IF NOT EXISTS templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('動画', 'ショート')),
                intro_content TEXT,
                narration_content TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `, (err) => {
              if (err) {
                logError('テンプレートテーブル作成エラー:', err);
                db.close();
                dbInitPromise = null;
                reject(err);
              } else {
                logInfo('データベースの初期化が完了しました。');
                db.close();
                dbInitialized = true;
                dbInitPromise = null;
                resolve();
              }
            });
          });
        } else {
          db.close();
          dbInitialized = true;
          dbInitPromise = null;
          resolve();
        }
      });
    });
  });
  
  return dbInitPromise;
}

// 初期ユーザー作成の状態を追跡
let userInitialized = false;

// データベース初期化ミドルウェア（すべてのAPIリクエストの前に実行）
app.use('/api', async (req, res, next) => {
  try {
    await initDatabase();
    
    // 初期ユーザーが存在しない場合は作成
    if (!userInitialized) {
      try {
        const db = getDb();
        const row = await dbGet(db, 'SELECT COUNT(*) as count FROM users');
        if (row.count === 0) {
          const username = process.env.INITIAL_USERNAME || 'admin';
          let password = process.env.INITIAL_PASSWORD;
          
          if (!password || password.length < 8) {
            console.warn('警告: 初期パスワードが設定されていないか、8文字未満です。');
            if (!password) {
              password = 'admin123';
              console.warn('デフォルトパスワード（admin123）が使用されます。すぐに変更してください。');
            }
          }
          
          const hash = await bcrypt.hash(password, 10);
          await dbRun(db, 'INSERT INTO users (username, password) VALUES (?, ?)', [username, hash]);
          logInfo('初期ユーザーが作成されました。');
        }
        db.close();
        userInitialized = true;
      } catch (err) {
        logError('初期ユーザー作成エラー:', err);
        // エラーが発生しても続行（既にユーザーが存在する可能性がある）
      }
    }
    
    next();
  } catch (err) {
    logError('データベース初期化ミドルウェアエラー:', err);
    res.status(500).json({ 
      error: 'データベースの初期化に失敗しました',
      message: err.message 
    });
  }
});

// データベース接続ヘルパー（Promiseベース）
function getDb() {
  return new sqlite3.Database(DB_PATH);
}

// データベース操作のラッパー（エラーハンドリングとクローズを保証）
function dbQuery(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        db.close();
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function dbGet(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        db.close();
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function dbRun(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) {
        db.close();
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

// 初期ユーザー作成（初回起動時のみ）
async function initUser() {
  try {
    // まずデータベースを初期化
    await initDatabase();
    
    const db = getDb();
    try {
      const row = await dbGet(db, 'SELECT COUNT(*) as count FROM users');
      if (row.count === 0) {
        const username = process.env.INITIAL_USERNAME || 'admin';
        let password = process.env.INITIAL_PASSWORD;
        
        // パスワードの検証
        if (!password || password.length < 8) {
          console.warn('警告: 初期パスワードが設定されていないか、8文字未満です。');
          console.warn('強力なパスワードを環境変数INITIAL_PASSWORDに設定してください。');
          if (!password) {
            password = 'admin123';
            console.warn('デフォルトパスワード（admin123）が使用されます。すぐに変更してください。');
          }
        }
        
        const hash = await bcrypt.hash(password, 10);
        await dbRun(db, 'INSERT INTO users (username, password) VALUES (?, ?)', [username, hash]);
        logInfo('初期ユーザーが作成されました。');
        if (password === 'admin123' || password.length < 8) {
          logWarn('重要: 初回ログイン後、必ず強力なパスワードに変更してください。');
        }
      }
      db.close();
    } catch (err) {
      logError('初期ユーザー作成エラー:', err);
      db.close();
    }
  } catch (err) {
    logError('データベース初期化エラー:', err);
  }
}

// 認証ミドルウェア
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login.html');
  }
}

// ログイン
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const db = getDb();
  
  try {
    const user = await dbGet(db, 'SELECT * FROM users WHERE username = ?', [username]);
    
    if (!user) {
      db.close();
      return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
    }
    
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      db.close();
      return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
    }
    
    req.session.userId = user.id;
    req.session.username = user.username;
    db.close();
    res.json({ success: true });
  } catch (err) {
    logError('ログインエラー:', err);
    db.close();
    res.status(500).json({ error: 'データベースエラー' });
  }
});

// ログアウト
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ユーザー情報取得
app.get('/api/user-info', requireAuth, async (req, res) => {
  const db = getDb();
  try {
    const user = await dbGet(db, 'SELECT username FROM users WHERE id = ?', [req.session.userId]);
    db.close();
    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }
    res.json({ username: user.username });
  } catch (err) {
    logError('ユーザー情報取得エラー:', err);
    db.close();
    res.status(500).json({ error: 'データベースエラー' });
  }
});

// ユーザー名変更
app.post('/api/change-username', requireAuth, async (req, res) => {
  const { newUsername } = req.body;
  const db = getDb();
  
  try {
    if (!newUsername) {
      db.close();
      return res.status(400).json({ error: 'ユーザー名を入力してください' });
    }
    
    const trimmedUsername = newUsername.trim();
    
    if (trimmedUsername.length < 3) {
      db.close();
      return res.status(400).json({ error: 'ユーザー名は3文字以上にしてください' });
    }
    
    // 既存のユーザー名かチェック
    const existing = await dbGet(db, 'SELECT id FROM users WHERE username = ? AND id != ?', [trimmedUsername, req.session.userId]);
    
    if (existing) {
      db.close();
      return res.status(400).json({ error: 'このユーザー名は既に使用されています' });
    }
    
    // ユーザー名を更新
    await dbRun(db, 'UPDATE users SET username = ? WHERE id = ?', [trimmedUsername, req.session.userId]);
    
    // セッションのユーザー名も更新
    req.session.username = trimmedUsername;
    db.close();
    res.json({ success: true, username: trimmedUsername });
  } catch (err) {
    logError('ユーザー名変更エラー:', err);
    db.close();
    res.status(500).json({ error: 'データベースエラー: ' + err.message });
  }
});

// パスワード変更
app.post('/api/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const db = getDb();
  
  try {
    if (!newPassword || newPassword.length < 6) {
      db.close();
      return res.status(400).json({ error: 'パスワードは6文字以上にしてください' });
    }
    
    const user = await dbGet(db, 'SELECT * FROM users WHERE id = ?', [req.session.userId]);
    
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      db.close();
      return res.status(401).json({ error: '現在のパスワードが正しくありません' });
    }
    
    const hash = await bcrypt.hash(newPassword, 10);
    await dbRun(db, 'UPDATE users SET password = ? WHERE id = ?', [hash, req.session.userId]);
    db.close();
    res.json({ success: true });
  } catch (err) {
    logError('パスワード変更エラー:', err);
    db.close();
    res.status(500).json({ error: 'パスワード更新エラー' });
  }
});

// チャンネル設定取得
app.get('/api/channel', requireAuth, async (req, res) => {
  const db = getDb();
  try {
    const row = await dbGet(db, 'SELECT * FROM channel_settings ORDER BY id DESC LIMIT 1');
    db.close();
    res.json(row || null);
  } catch (err) {
    logError('チャンネル設定取得エラー:', err);
    db.close();
    res.status(500).json({ error: 'データベースエラー' });
  }
});

// チャンネル設定保存
app.post('/api/channel', requireAuth, async (req, res) => {
  const { channel_name, channel_url, channel_image_url } = req.body;
  const db = getDb();
  
  try {
    const row = await dbGet(db, 'SELECT COUNT(*) as count FROM channel_settings');
    
    if (row.count === 0) {
      await dbRun(db, 'INSERT INTO channel_settings (channel_name, channel_url, channel_image_url) VALUES (?, ?, ?)',
        [channel_name, channel_url, channel_image_url || '']);
    } else {
      await dbRun(db, 'UPDATE channel_settings SET channel_name = ?, channel_url = ?, channel_image_url = ?, updated_at = CURRENT_TIMESTAMP',
        [channel_name, channel_url, channel_image_url || '']);
    }
    db.close();
    res.json({ success: true });
  } catch (err) {
    logError('チャンネル設定保存エラー:', err);
    db.close();
    res.status(500).json({ error: '保存エラー' });
  }
});

// 動画予定一覧取得
app.get('/api/video-plans', requireAuth, async (req, res) => {
  const db = getDb();
  const isPosted = req.query.posted;
  const search = req.query.search;
  
  try {
    let query = 'SELECT * FROM video_plans';
    const params = [];
    const conditions = [];
    
    if (isPosted !== undefined) {
      conditions.push('is_posted = ?');
      params.push(isPosted === 'true' ? 1 : 0);
    }
    
    if (search && search.trim()) {
      conditions.push('(title LIKE ? OR intro_content LIKE ? OR narration_content LIKE ?)');
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY no ASC, created_at DESC';
    
    const rows = await dbQuery(db, query, params);
    db.close();
    res.json(rows);
  } catch (err) {
    logError('動画予定一覧取得エラー:', err);
    db.close();
    res.status(500).json({ error: 'データベースエラー' });
  }
});

// 動画予定取得（単一）
app.get('/api/video-plans/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  
  try {
    const plan = await dbGet(db, 'SELECT * FROM video_plans WHERE id = ?', [id]);
    db.close();
    if (plan) {
      res.json(plan);
    } else {
      res.status(404).json({ error: '動画予定が見つかりません' });
    }
  } catch (err) {
    logError('動画予定取得エラー:', err);
    db.close();
    res.status(500).json({ error: 'データベースエラー' });
  }
});

// 動画予定作成
app.post('/api/video-plans', requireAuth, validateVideoPlan, async (req, res) => {
  const { no, type, title, intro_content, narration_content, tags, category, reminder_date } = req.body;
  const db = getDb();
  
  try {
    // Noが指定されていない場合は自動設定（最大No+1）
    let finalNo = no;
    if (!finalNo) {
      const row = await dbGet(db, 'SELECT MAX(no) as maxNo FROM video_plans');
      finalNo = (row.maxNo || 0) + 1;
    }
    
    const result = await dbRun(db,
      'INSERT INTO video_plans (no, type, title, intro_content, narration_content, tags, category, reminder_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [finalNo, type, title, intro_content || '', narration_content || '', tags || '', category || '', reminder_date || null]
    );
    db.close();
    res.json({ success: true, id: result.lastID });
  } catch (err) {
    logError('動画予定作成エラー:', err);
    db.close();
    res.status(500).json({ error: '作成エラー' });
  }
});

// 動画予定更新
app.put('/api/video-plans/:id', requireAuth, validateVideoPlan, async (req, res) => {
  const { id } = req.params;
  const { no, type, title, intro_content, narration_content, tags, category, reminder_date, is_posted } = req.body;
  const db = getDb();
  
  try {
    const postedAt = is_posted === 1 || is_posted === true ? new Date().toISOString() : null;
    
    // 既存の動画予定情報を取得
    const plan = await dbGet(db, 'SELECT * FROM video_plans WHERE id = ?', [id]);

    // 投稿済みにチェックがついた場合、投稿済み動画テーブルにも追加
    if ((is_posted === 1 || is_posted === true) && plan.is_posted !== 1) {
      // 既に投稿済み動画に存在するかチェック（タイトルと投稿日で）
      try {
        const existing = await dbGet(db, 'SELECT id FROM posted_videos WHERE title = ? AND published_at = ?', [title, postedAt]);
        if (!existing) {
          // 投稿済み動画に追加
          const row = await dbGet(db, 'SELECT MAX(no) as maxNo FROM posted_videos');
          const postedNo = (row && row.maxNo ? row.maxNo : 0) + 1;
          await dbRun(db,
            'INSERT INTO posted_videos (no, type, title, published_at, thumbnail_url, url, is_public, tags, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [postedNo, type, title, postedAt, '', '', 1, tags || '', category || '']
          );
        }
      } catch (err) {
        logError('投稿済み動画追加エラー:', err);
        // エラーが発生しても動画予定の更新は続行
      }
    }
    
    // 動画予定を更新
    await dbRun(db,
      'UPDATE video_plans SET no = ?, type = ?, title = ?, intro_content = ?, narration_content = ?, tags = ?, category = ?, reminder_date = ?, is_posted = ?, posted_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [no, type, title, intro_content || '', narration_content || '', tags || '', category || '', reminder_date || null, is_posted ? 1 : 0, postedAt, id]
    );
    db.close();
    res.json({ success: true });
  } catch (err) {
    logError('動画予定更新エラー:', err);
    db.close();
    res.status(500).json({ error: '更新エラー' });
  }
});

// 動画予定削除
app.delete('/api/video-plans/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  
  try {
    await dbRun(db, 'DELETE FROM video_plans WHERE id = ?', [id]);
    db.close();
    res.json({ success: true });
  } catch (err) {
    logError('動画予定削除エラー:', err);
    db.close();
    res.status(500).json({ error: '削除エラー' });
  }
});

// 動画予定一括削除
app.post('/api/video-plans/bulk-delete', requireAuth, async (req, res) => {
  const { ids } = req.body;
  const db = getDb();
  
  try {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      db.close();
      return res.status(400).json({ error: '削除するIDが指定されていません' });
    }
    
    const placeholders = ids.map(() => '?').join(',');
    await dbRun(db, `DELETE FROM video_plans WHERE id IN (${placeholders})`, ids);
    db.close();
    res.json({ success: true, count: ids.length });
  } catch (err) {
    logError('動画予定一括削除エラー:', err);
    db.close();
    res.status(500).json({ error: '一括削除エラー' });
  }
});

// 動画予定一括投稿済み移動
app.post('/api/video-plans/bulk-move-to-posted', requireAuth, async (req, res) => {
  const { ids } = req.body;
  const db = getDb();
  
  try {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      db.close();
      return res.status(400).json({ error: '移動するIDが指定されていません' });
    }
    
    const postedAt = new Date().toISOString();
    const placeholders = ids.map(() => '?').join(',');
    
    // 動画予定を投稿済みに更新
    await dbRun(db, 
      `UPDATE video_plans SET is_posted = 1, posted_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      [postedAt, ...ids]
    );
    
    // 投稿済み動画テーブルに追加（既存チェック付き）
    const plans = await dbQuery(db, 
      `SELECT * FROM video_plans WHERE id IN (${placeholders})`,
      ids
    );
    
    let addedCount = 0;
    for (const plan of plans) {
      try {
        // 既に存在するかチェック
        const existing = await dbGet(db, 
          'SELECT id FROM posted_videos WHERE title = ? AND published_at = ?',
          [plan.title, postedAt]
        );
        
        if (!existing) {
          const row = await dbGet(db, 'SELECT MAX(no) as maxNo FROM posted_videos');
          const postedNo = (row && row.maxNo ? row.maxNo : 0) + 1;
          await dbRun(db,
            'INSERT INTO posted_videos (no, type, title, published_at, thumbnail_url, url, is_public) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [postedNo, plan.type, plan.title, postedAt, '', '', 1]
          );
          addedCount++;
        }
      } catch (err) {
        logError('投稿済み動画追加エラー:', err);
      }
    }
    
    db.close();
    res.json({ success: true, count: ids.length, addedCount });
  } catch (err) {
    logError('動画予定一括移動エラー:', err);
    db.close();
    res.status(500).json({ error: '一括移動エラー' });
  }
});

// 投稿済み動画一覧取得
app.get('/api/posted-videos', requireAuth, async (req, res) => {
  const db = getDb();
  const type = req.query.type;
  const search = req.query.search;
  
  try {
    let query = 'SELECT * FROM posted_videos';
    const params = [];
    const conditions = [];
    
    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }
    
    if (search && search.trim()) {
      conditions.push('title LIKE ?');
      params.push(`%${search.trim()}%`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY no ASC, published_at ASC';
    
    const rows = await dbQuery(db, query, params);
    db.close();
    res.json(rows);
  } catch (err) {
    logError('投稿済み動画一覧取得エラー:', err);
    db.close();
    res.status(500).json({ error: 'データベースエラー' });
  }
});

// 投稿済み動画作成
app.post('/api/posted-videos', requireAuth, validatePostedVideo, async (req, res) => {
  const { no, type, title, published_at, thumbnail_url, url, view_count, like_count, is_converted_to_video, is_public, tags, category } = req.body;
  const db = getDb();
  
  try {
    const result = await dbRun(db,
      'INSERT INTO posted_videos (no, type, title, published_at, thumbnail_url, url, view_count, like_count, is_converted_to_video, is_public, tags, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [no || 0, type, title, published_at, thumbnail_url || '', url || '', view_count || 0, like_count || 0, is_converted_to_video ? 1 : 0, is_public ? 1 : 1, tags || '', category || '']
    );
    db.close();
    res.json({ success: true, id: result.lastID });
  } catch (err) {
    logError('投稿済み動画作成エラー:', err);
    db.close();
    res.status(500).json({ error: '作成エラー' });
  }
});

// 投稿済み動画更新
app.put('/api/posted-videos/:id', requireAuth, validatePostedVideo, async (req, res) => {
  const { id } = req.params;
  const { no, type, title, published_at, thumbnail_url, url, view_count, like_count, is_converted_to_video, is_public, tags, category } = req.body;
  const db = getDb();
  
  try {
    await dbRun(db,
      'UPDATE posted_videos SET no = ?, type = ?, title = ?, published_at = ?, thumbnail_url = ?, url = ?, view_count = ?, like_count = ?, is_converted_to_video = ?, is_public = ?, tags = ?, category = ? WHERE id = ?',
      [no || 0, type, title, published_at, thumbnail_url || '', url || '', view_count || 0, like_count || 0, is_converted_to_video ? 1 : 0, is_public ? 1 : 1, tags || '', category || '', id]
    );
    db.close();
    res.json({ success: true });
  } catch (err) {
    logError('投稿済み動画更新エラー:', err);
    db.close();
    res.status(500).json({ error: '更新エラー' });
  }
});

// 投稿済み動画削除
app.delete('/api/posted-videos/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  
  try {
    await dbRun(db, 'DELETE FROM posted_videos WHERE id = ?', [id]);
    db.close();
    res.json({ success: true });
  } catch (err) {
    logError('投稿済み動画削除エラー:', err);
    db.close();
    res.status(500).json({ error: '削除エラー' });
  }
});

// 投稿済み動画一括削除
app.post('/api/posted-videos/bulk-delete', requireAuth, async (req, res) => {
  const { ids } = req.body;
  const db = getDb();
  
  try {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      db.close();
      return res.status(400).json({ error: '削除するIDが指定されていません' });
    }
    
    const placeholders = ids.map(() => '?').join(',');
    await dbRun(db, `DELETE FROM posted_videos WHERE id IN (${placeholders})`, ids);
    db.close();
    res.json({ success: true, count: ids.length });
  } catch (err) {
    logError('投稿済み動画一括削除エラー:', err);
    db.close();
    res.status(500).json({ error: '一括削除エラー' });
  }
});

// CSV一括インポート
app.post('/api/video-plans/import-csv', requireAuth, async (req, res) => {
  const { plans } = req.body; // [{type, title, intro_content, narration_content}, ...]
  const db = getDb();
  
  try {
    // 現在の最大Noを取得
    const row = await dbGet(db, 'SELECT MAX(no) as maxNo FROM video_plans');
    let currentNo = row.maxNo || 0;
    let successCount = 0;
    let errorCount = 0;
    
    // 各プランを順次挿入
    for (const plan of plans) {
      currentNo++;
      try {
        await dbRun(db,
          'INSERT INTO video_plans (no, type, title, intro_content, narration_content) VALUES (?, ?, ?, ?, ?)',
          [currentNo, plan.type, plan.title, plan.intro_content || '', plan.narration_content || '']
        );
        successCount++;
      } catch (insertErr) {
        logError('CSVインポート - 個別エラー:', insertErr);
        errorCount++;
      }
    }
    
    db.close();
    res.json({ success: true, successCount, errorCount });
  } catch (err) {
    logError('CSVインポートエラー:', err);
    db.close();
    res.status(500).json({ error: 'データベースエラー' });
  }
});

// 次のNoを取得
app.get('/api/video-plans/next-no', requireAuth, async (req, res) => {
  const db = getDb();
  try {
    const row = await dbGet(db, 'SELECT MAX(no) as maxNo FROM video_plans');
    db.close();
    const nextNo = (row.maxNo || 0) + 1;
    res.json({ nextNo });
  } catch (err) {
    logError('次のNo取得エラー:', err);
    db.close();
    res.status(500).json({ error: 'データベースエラー' });
  }
});

// YouTube APIから動画取得
app.post('/api/fetch-youtube-videos', requireAuth, async (req, res) => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ 
      error: 'YouTube APIキーが設定されていません。.envファイルにYOUTUBE_API_KEYを設定してください。' 
    });
  }
  
  // APIキーの形式チェック（簡単な検証）
  if (apiKey === 'your-youtube-api-key-here' || apiKey.length < 20) {
    return res.status(400).json({ 
      error: 'YouTube APIキーが正しく設定されていません。.envファイルのYOUTUBE_API_KEYを確認してください。' 
    });
  }
  
  const channelUrl = req.body.channel_url;
  if (!channelUrl) {
    return res.status(400).json({ error: 'チャンネルURLが必要です' });
  }
  
  // チャンネルURLからチャンネルIDを取得
  let channelId = '';
  let errorMessage = '';
  
  try {
    if (channelUrl.includes('/@')) {
      // @ハンドル形式 (例: https://www.youtube.com/@channelname)
      const handle = channelUrl.split('/@')[1].split('/')[0].split('?')[0];
      
      // 方法1: channels APIのforHandleパラメータを試す（新しいAPI）
      try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
          params: {
            part: 'id',
            forHandle: handle,
            key: apiKey
          }
        });
        if (response.data.items && response.data.items.length > 0) {
          channelId = response.data.items[0].id;
        }
      } catch (handleError) {
        // forHandleが使えない場合は、search APIで検索
        logDebug('forHandle APIが利用できないため、search APIを使用します');
        const searchResponse = await axios.get('https://www.googleapis.com/youtube/v3/search', {
          params: {
            part: 'snippet',
            q: handle,
            type: 'channel',
            maxResults: 1,
            key: apiKey
          }
        });
        if (searchResponse.data.items && searchResponse.data.items.length > 0) {
          // search APIの結果からchannelIdを取得
          channelId = searchResponse.data.items[0].id.channelId;
        }
      }
      
      if (!channelId) {
        errorMessage = `@${handle} のチャンネルが見つかりませんでした。チャンネルURLが正しいか確認してください。`;
      }
    } else if (channelUrl.includes('channel/')) {
      // チャンネルID形式 (例: https://www.youtube.com/channel/UCxxxxx)
      channelId = channelUrl.split('channel/')[1].split('/')[0].split('?')[0];
    } else if (channelUrl.includes('c/')) {
      // カスタムURL形式 (例: https://www.youtube.com/c/channelname)
      const username = channelUrl.split('c/')[1].split('/')[0].split('?')[0];
      try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
          params: {
            part: 'id',
            forUsername: username,
            key: apiKey
          }
        });
        if (response.data.items && response.data.items.length > 0) {
          channelId = response.data.items[0].id;
        } else {
          errorMessage = `ユーザー名 "${username}" のチャンネルが見つかりませんでした。`;
        }
      } catch (error) {
        logError('チャンネルID取得エラー (c/):', error.response?.data || error.message);
        const apiError = error.response?.data?.error;
        if (apiError?.message?.includes('API key') || apiError?.message?.includes('APIキー')) {
          errorMessage = 'YouTube APIキーが無効です。.envファイルのYOUTUBE_API_KEYを確認し、Google Cloud Consoleで正しいAPIキーを設定してください。';
        } else {
          errorMessage = `チャンネルIDの取得に失敗しました: ${apiError?.message || error.message}`;
        }
      }
    } else {
      errorMessage = 'サポートされていないチャンネルURL形式です。以下の形式をサポートしています:\n- https://www.youtube.com/@channelname\n- https://www.youtube.com/channel/UCxxxxx\n- https://www.youtube.com/c/channelname';
    }
  } catch (error) {
    logError('チャンネルID取得エラー:', error.response?.data || error.message);
    const apiError = error.response?.data?.error;
    if (apiError?.message?.includes('API key') || apiError?.message?.includes('APIキー')) {
      errorMessage = 'YouTube APIキーが無効です。.envファイルのYOUTUBE_API_KEYを確認し、Google Cloud Consoleで正しいAPIキーを設定してください。';
    } else {
      errorMessage = `チャンネルIDの取得に失敗しました: ${apiError?.message || error.message}`;
    }
  }
  
  if (!channelId) {
    return res.status(400).json({ 
      error: errorMessage || 'チャンネルIDが取得できませんでした。チャンネルURLを確認してください。' 
    });
  }
  
  try {
    // 動画一覧を取得
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        channelId: channelId,
        type: 'video',
        maxResults: 50,
        order: 'date',
        key: apiKey
      }
    });
    
    const db = getDb();
    const videos = response.data.items || [];
    
    // 動画詳細を取得して動画時間で判定（ショートは60秒以下）
    for (const item of videos) {
      try {
        const detailResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
          params: {
            part: 'contentDetails,statistics',
            id: item.id.videoId,
            key: apiKey
          }
        });
        
        if (detailResponse.data.items && detailResponse.data.items.length > 0) {
          const video = detailResponse.data.items[0];
          const duration = video.contentDetails.duration;
          const seconds = parseDuration(duration);
          const type = seconds <= 60 ? 'ショート' : '動画';
          
          const publishedAt = new Date(item.snippet.publishedAt).toISOString();
          const viewCount = parseInt(video.statistics.viewCount || 0);
          const likeCount = parseInt(video.statistics.likeCount || 0);
          
          db.run(
            `INSERT OR IGNORE INTO posted_videos (video_id, title, type, published_at, thumbnail_url, view_count, like_count, url) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              item.id.videoId,
              item.snippet.title,
              type,
              publishedAt,
              item.snippet.thumbnails.default.url,
              viewCount,
              likeCount,
              `https://www.youtube.com/watch?v=${item.id.videoId}`
            ]
          );
        }
      } catch (error) {
        logError('動画詳細取得エラー:', error);
      }
    }
    
    db.close();
    res.json({ success: true, count: videos.length });
  } catch (error) {
    logError('YouTube API エラー:', error);
    const apiError = error.response?.data?.error;
    let errorMsg = '動画取得エラーが発生しました';
    
    if (apiError) {
      if (apiError.message?.includes('API key') || apiError.message?.includes('APIキー')) {
        errorMsg = 'YouTube APIキーが無効です。.envファイルのYOUTUBE_API_KEYを確認し、Google Cloud Consoleで正しいAPIキーを設定してください。';
      } else if (apiError.message?.includes('quota') || apiError.message?.includes('クォータ')) {
        errorMsg = 'YouTube APIの使用制限に達しました。しばらく時間をおいてから再度お試しください。';
      } else {
        errorMsg = `動画取得エラー: ${apiError.message}`;
      }
    } else {
      errorMsg = `動画取得エラー: ${error.message}`;
    }
    
    res.status(500).json({ error: errorMsg });
  }
});

// 動画時間（ISO 8601形式）を秒に変換
function parseDuration(duration) {
  if (!duration || typeof duration !== 'string') {
    return 0;
  }
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) {
    logWarn('動画時間の解析に失敗:', duration);
    return 0;
  }
  
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  
  return hours * 3600 + minutes * 60 + seconds;
}

// 画像アップロード（チャンネル画像用）
app.post('/api/upload-image', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '画像ファイルが選択されていません' });
  }
  
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, imageUrl: imageUrl });
});

// サムネイル画像アップロード
app.post('/api/upload-thumbnail', requireAuth, uploadThumbnail.single('thumbnail'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '画像ファイルが選択されていません' });
  }
  
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, imageUrl: imageUrl });
});

// テンプレート一覧取得
app.get('/api/templates', requireAuth, async (req, res) => {
  const db = getDb();
  try {
    const rows = await dbQuery(db, 'SELECT * FROM templates ORDER BY created_at DESC');
    db.close();
    res.json(rows);
  } catch (err) {
    logError('テンプレート一覧取得エラー:', err);
    db.close();
    res.status(500).json({ error: 'データベースエラー' });
  }
});

// テンプレート作成
app.post('/api/templates', requireAuth, async (req, res) => {
  const { name, type, intro_content, narration_content } = req.body;
  const db = getDb();
  
  try {
    if (!name || !type) {
      db.close();
      return res.status(400).json({ error: 'テンプレート名と種類は必須です' });
    }
    
    const result = await dbRun(db,
      'INSERT INTO templates (name, type, intro_content, narration_content) VALUES (?, ?, ?, ?)',
      [name, type, intro_content || '', narration_content || '']
    );
    db.close();
    res.json({ success: true, id: result.lastID });
  } catch (err) {
    logError('テンプレート作成エラー:', err);
    db.close();
    res.status(500).json({ error: '作成エラー' });
  }
});

// テンプレート更新
app.put('/api/templates/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, type, intro_content, narration_content } = req.body;
  const db = getDb();
  
  try {
    await dbRun(db,
      'UPDATE templates SET name = ?, type = ?, intro_content = ?, narration_content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, type, intro_content || '', narration_content || '', id]
    );
    db.close();
    res.json({ success: true });
  } catch (err) {
    logError('テンプレート更新エラー:', err);
    db.close();
    res.status(500).json({ error: '更新エラー' });
  }
});

// テンプレート削除
app.delete('/api/templates/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  
  try {
    await dbRun(db, 'DELETE FROM templates WHERE id = ?', [id]);
    db.close();
    res.json({ success: true });
  } catch (err) {
    logError('テンプレート削除エラー:', err);
    db.close();
    res.status(500).json({ error: '削除エラー' });
  }
});

// 統計データ取得
app.get('/api/statistics', requireAuth, async (req, res) => {
  const db = getDb();
  
  try {
    // 動画予定の統計
    const plansStats = await dbGet(db, `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_posted = 1 THEN 1 ELSE 0 END) as posted,
        SUM(CASE WHEN is_posted = 0 THEN 1 ELSE 0 END) as not_posted,
        SUM(CASE WHEN type = '動画' THEN 1 ELSE 0 END) as video_count,
        SUM(CASE WHEN type = 'ショート' THEN 1 ELSE 0 END) as short_count
      FROM video_plans
    `);
    
    // 投稿済み動画の統計
    const videosStats = await dbGet(db, `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN type = '動画' THEN 1 ELSE 0 END) as video_count,
        SUM(CASE WHEN type = 'ショート' THEN 1 ELSE 0 END) as short_count,
        SUM(view_count) as total_views,
        SUM(like_count) as total_likes,
        AVG(view_count) as avg_views,
        AVG(like_count) as avg_likes
      FROM posted_videos
    `);
    
    // 月別投稿数
    const monthlyPosts = await dbQuery(db, `
      SELECT 
        strftime('%Y-%m', published_at) as month,
        COUNT(*) as count
      FROM posted_videos
      WHERE published_at IS NOT NULL
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `);
    
    // トップ動画（視聴回数順）
    const topVideos = await dbQuery(db, `
      SELECT id, title, view_count, like_count, published_at, type
      FROM posted_videos
      WHERE view_count > 0
      ORDER BY view_count DESC
      LIMIT 10
    `);
    
    db.close();
    res.json({
      plans: plansStats,
      videos: videosStats,
      monthlyPosts: monthlyPosts || [],
      topVideos: topVideos || []
    });
  } catch (err) {
    logError('統計データ取得エラー:', err);
    db.close();
    res.status(500).json({ error: 'データベースエラー' });
  }
});

// 下書き保存
app.post('/api/video-plans/draft', requireAuth, async (req, res) => {
  const { draft_content } = req.body;
  const db = getDb();
  
  try {
    // 最新の下書きを更新（または新規作成）
    const existing = await dbGet(db, 'SELECT id FROM video_plans WHERE draft_content IS NOT NULL ORDER BY updated_at DESC LIMIT 1');
    
    if (existing) {
      await dbRun(db, 'UPDATE video_plans SET draft_content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [draft_content, existing.id]);
    } else {
      // 新規作成（一時的なレコード）
      await dbRun(db, 'INSERT INTO video_plans (no, type, title, draft_content) VALUES (?, ?, ?, ?)', [0, '動画', '下書き', draft_content]);
    }
    
    db.close();
    res.json({ success: true });
  } catch (err) {
    logError('下書き保存エラー:', err);
    db.close();
    res.status(500).json({ error: '下書き保存エラー' });
  }
});

// 下書き取得
app.get('/api/video-plans/draft', requireAuth, async (req, res) => {
  const db = getDb();
  
  try {
    const draft = await dbGet(db, 'SELECT draft_content FROM video_plans WHERE draft_content IS NOT NULL ORDER BY updated_at DESC LIMIT 1');
    db.close();
    res.json(draft || { draft_content: null });
  } catch (err) {
    logError('下書き取得エラー:', err);
    db.close();
    res.status(500).json({ error: '下書き取得エラー' });
  }
});

// テンプレート取得（単一）
app.get('/api/templates/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  
  try {
    const template = await dbGet(db, 'SELECT * FROM templates WHERE id = ?', [id]);
    db.close();
    if (template) {
      res.json(template);
    } else {
      res.status(404).json({ error: 'テンプレートが見つかりません' });
    }
  } catch (err) {
    logError('テンプレート取得エラー:', err);
    db.close();
    res.status(500).json({ error: 'データベースエラー' });
  }
});

// ルート
app.get('/', requireAuth, (req, res) => {
  res.redirect('/top.html');
});

// グローバルエラーハンドラー（すべてのルートの後に配置）
app.use((err, req, res, next) => {
  logError('エラーハンドラー:', err);
  // 既にレスポンスが送信されている場合は何もしない
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    error: err.message || '内部サーバーエラーが発生しました',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 404ハンドラー（すべてのルートの後に配置）
app.use((req, res) => {
  res.status(404).json({ error: 'リソースが見つかりません' });
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  logInfo('SIGTERMシグナルを受信しました。グレースフルシャットダウンを開始します...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logInfo('SIGINTシグナルを受信しました。グレースフルシャットダウンを開始します...');
  process.exit(0);
});

// 未処理のエラーをキャッチ
process.on('unhandledRejection', (reason, promise) => {
  logError('未処理のPromise拒否:', reason);
});

process.on('uncaughtException', (error) => {
  logError('未処理の例外:', error);
  process.exit(1);
});

// サーバー起動時の初期化（ローカル開発環境のみ）
// Vercel環境では、リクエスト時にミドルウェアで初期化される
if (require.main === module) {
  initUser().catch(err => {
    logError('起動時の初期化エラー:', err);
  });
}

// モジュールとして require された場合（Vercel serverless）は app をエクスポート
// 直接実行された場合（ローカル開発）は listen を実行
if (require.main === module) {
  // ローカル開発環境では通常通り listen
  app.listen(PORT, () => {
    logInfo(`サーバーが起動しました: http://localhost:${PORT}`);
    if (!isProduction) {
      logWarn('開発モードで実行中です。本番環境ではNODE_ENV=productionを設定してください。');
    }
  });
} else {
  // Vercel環境では app をエクスポート（api/index.js で使用）
  module.exports = app;
}

