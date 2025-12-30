const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'videos.db');

// 既存のDBファイルがあれば削除（開発用）
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // ユーザーテーブル
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // チャンネル設定テーブル
  db.run(`
    CREATE TABLE channel_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_name TEXT NOT NULL,
      channel_url TEXT NOT NULL,
      channel_image_url TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 動画予定テーブル
  db.run(`
    CREATE TABLE video_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('動画', 'ショート')),
      title TEXT NOT NULL,
      intro_content TEXT,
      narration_content TEXT,
      is_posted INTEGER DEFAULT 0 CHECK(is_posted IN (0, 1)),
      posted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 投稿済み動画テーブル
  db.run(`
    CREATE TABLE posted_videos (
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('データベースの初期化が完了しました。');
});

db.close();

