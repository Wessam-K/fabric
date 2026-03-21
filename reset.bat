@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════════
echo   WK-Hub Database Reset
echo ═══════════════════════════════════════════
echo.
echo WARNING: This will DELETE all data and recreate the database!
echo.
set /p confirm="Are you sure? (y/n): "
if /i not "%confirm%"=="y" (
    echo Cancelled.
    exit /b 0
)

cd /d "%~dp0backend"

echo.
echo [1/3] Stopping any running server on port 9002...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":9002" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo [2/3] Deleting database files...
if exist "wk-hub.db" del /f "wk-hub.db"
if exist "wk-hub.db-shm" del /f "wk-hub.db-shm"
if exist "wk-hub.db-wal" del /f "wk-hub.db-wal"

echo [3/3] Recreating database schema...
node -e "require('./database'); console.log('Database recreated successfully with schema V' + require('./database').prepare('SELECT MAX(version) as v FROM schema_migrations').get().v)"

echo.
echo ✅ Database has been reset!
echo    Run seed.bat to populate with sample data.
echo.
pause
