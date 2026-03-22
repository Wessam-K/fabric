@echo off
chcp 65001 >nul
title WK-Hub Factory System
echo ═══════════════════════════════════════════
echo    WK-Hub - Factory Management System
echo ═══════════════════════════════════════════
echo.

cd /d "%~dp0"

:: Kill any existing processes on our ports
echo [1/5] Stopping any running servers...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":9002" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":9173" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Check if node_modules exist
echo [2/5] Checking dependencies...
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend && npm install && cd ..
)
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend && npm install && cd ..
)

:: Seed DB if missing
echo [3/5] Checking database...
if not exist "backend\wk-hub.db" (
    echo Database not found, seeding...
    cd backend && node seed.js && cd ..
)

echo [4/5] Starting backend server on port 9002...
start /B cmd /C "cd /d %~dp0backend && node server.js"

:: Wait a moment for backend to be ready
timeout /t 2 /nobreak >nul

echo [5/5] Starting frontend on port 9173...
echo.
echo ═══════════════════════════════════════════
echo   Backend:  http://localhost:9002
echo   Frontend: http://localhost:9173
echo ═══════════════════════════════════════════
echo   Login: admin / 123456
echo   Press Ctrl+C to stop
echo ═══════════════════════════════════════════
echo.

cd frontend && npx vite --port 9173
