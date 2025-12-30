const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'videos.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 既存のカラムをチェックして、なければ追加
  db.all("PRAGMA table_info(posted_videos)", (err, columns) => {
    if (err) {
      console.error('テーブル情報の取得エラー:', err);
      db.close();
      return;
    }

    const columnNames = columns.map(col => col.name);

    // noカラムの追加
    if (!columnNames.includes('no')) {
      db.run("ALTER TABLE posted_videos ADD COLUMN no INTEGER DEFAULT 0", (err) => {
        if (err) {
          console.error('noカラム追加エラー:', err);
        } else {
          console.log('noカラムを追加しました');
        }
      });
    }

    // is_converted_to_videoカラムの追加
    if (!columnNames.includes('is_converted_to_video')) {
      db.run("ALTER TABLE posted_videos ADD COLUMN is_converted_to_video INTEGER DEFAULT 0 CHECK(is_converted_to_video IN (0, 1))", (err) => {
        if (err) {
          console.error('is_converted_to_videoカラム追加エラー:', err);
        } else {
          console.log('is_converted_to_videoカラムを追加しました');
        }
      });
    }

    // is_publicカラムの追加
    if (!columnNames.includes('is_public')) {
      db.run("ALTER TABLE posted_videos ADD COLUMN is_public INTEGER DEFAULT 1 CHECK(is_public IN (0, 1))", (err) => {
        if (err) {
          console.error('is_publicカラム追加エラー:', err);
        } else {
          console.log('is_publicカラムを追加しました');
        }
      });
    }

    setTimeout(() => {
      console.log('マイグレーションが完了しました');
      db.close();
    }, 1000);
  });
});

