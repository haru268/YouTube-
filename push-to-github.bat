@echo off
chcp 65001 >nul
echo GitHubにプッシュを開始します...

REM Gitリポジトリを初期化（既に初期化されている場合はスキップ）
if not exist .git (
    echo Gitリポジトリを初期化中...
    git init
)

REM すべてのファイルをステージング
echo ファイルをステージング中...
git add .

REM 初回コミット
echo コミット中...
git commit -m "Initial commit: YouTube動画管理システム"

REM リモートリポジトリを追加（HTTPS使用に変更）
echo リモートリポジトリを設定中（HTTPS）...
git remote remove origin 2>nul
git remote add origin https://github.com/haru268/YouTube-.git

REM メインブランチを設定
echo ブランチを設定中...
git branch -M main

REM GitHubにプッシュ
echo GitHubにプッシュ中...
echo （GitHubのユーザー名とパスワード（またはPersonal Access Token）の入力が求められます）
echo.
git push -u origin main

echo.
echo 完了しました！
pause

