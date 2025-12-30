const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'videos.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 既存のカラムをチェックして、なければ追加
  db.all("PRAGMA table_info(video_plans)", (err, columns) => {
    if (err) {
      console.error('テーブル情報の取得エラー:', err);
      db.close();
      return;
    }

    const columnNames = columns.map(col => col.name);

    // tagsカラムの追加
    if (!columnNames.includes('tags')) {
      db.run("ALTER TABLE video_plans ADD COLUMN tags TEXT", (err) => {
        if (err) {
          console.error('tagsカラム追加エラー:', err);
        } else {
          console.log('video_plansテーブルにtagsカラムを追加しました');
        }
      });
    }

    // categoryカラムの追加
    if (!columnNames.includes('category')) {
      db.run("ALTER TABLE video_plans ADD COLUMN category TEXT", (err) => {
        if (err) {
          console.error('categoryカラム追加エラー:', err);
        } else {
          console.log('video_plansテーブルにcategoryカラムを追加しました');
        }
      });
    }

    // draft_contentカラムの追加（下書き保存用）
    if (!columnNames.includes('draft_content')) {
      db.run("ALTER TABLE video_plans ADD COLUMN draft_content TEXT", (err) => {
        if (err) {
          console.error('draft_contentカラム追加エラー:', err);
        } else {
          console.log('video_plansテーブルにdraft_contentカラムを追加しました');
        }
      });
    }

    // reminder_dateカラムの追加
    if (!columnNames.includes('reminder_date')) {
      db.run("ALTER TABLE video_plans ADD COLUMN reminder_date DATETIME", (err) => {
        if (err) {
          console.error('reminder_dateカラム追加エラー:', err);
        } else {
          console.log('video_plansテーブルにreminder_dateカラムを追加しました');
        }
      });
    }
  });

  // posted_videosテーブルにもtagsとcategoryを追加
  db.all("PRAGMA table_info(posted_videos)", (err, columns) => {
    if (err) {
      console.error('テーブル情報の取得エラー:', err);
      return;
    }

    const columnNames = columns.map(col => col.name);

    if (!columnNames.includes('tags')) {
      db.run("ALTER TABLE posted_videos ADD COLUMN tags TEXT", (err) => {
        if (err) {
          console.error('tagsカラム追加エラー:', err);
        } else {
          console.log('posted_videosテーブルにtagsカラムを追加しました');
        }
      });
    }

    if (!columnNames.includes('category')) {
      db.run("ALTER TABLE posted_videos ADD COLUMN category TEXT", (err) => {
        if (err) {
          console.error('categoryカラム追加エラー:', err);
        } else {
          console.log('posted_videosテーブルにcategoryカラムを追加しました');
        }
      });
    }
  });

  // テンプレートテーブルの作成
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
      console.error('templatesテーブル作成エラー:', err);
    } else {
      console.log('templatesテーブルを作成しました');
    }
  });

  setTimeout(() => {
    console.log('マイグレーションv2が完了しました');
    db.close();
  }, 2000);
});

