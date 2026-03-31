@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title WK-Hub Factory System
echo ═══════════════════════════════════════════
echo    WK-Hub - Factory Management System
echo ═══════════════════════════════════════════
echo.

cd /d "%~dp0"

:: Use Node.js 22 LTS (better-sqlite3 requires it)
if exist "%~dp0..\node22\node-v22.16.0-win-x64\node.exe" (
    set "PATH=%~dp0..\node22\node-v22.16.0-win-x64;%PATH%"
    echo Using Node.js 22 LTS from node22 folder
) else (
    echo WARNING: Node 22 not found, using system Node
)

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

:: Wait for backend to be ready (poll health endpoint)
echo      Waiting for backend to be ready...
set BACKEND_READY=0
for /L %%i in (1,1,30) do (
    if !BACKEND_READY! == 0 (
        curl -s -o nul -w "" http://localhost:9002/api/health >nul 2>&1
        if !errorlevel! == 0 (
            set BACKEND_READY=1
            echo      Backend is ready!
        ) else (
            timeout /t 1 /nobreak >nul
        )
    )
)
if !BACKEND_READY! == 0 (
    echo      WARNING: Backend may not be ready yet, starting frontend anyway...
)

echo [5/5] Starting frontend on port 9173...
echo.
echo ═══════════════════════════════════════════
echo   Backend:  http://localhost:9002
echo   Frontend: http://localhost:9173
echo ═══════════════════════════════════════════
echo   Use your configured credentials to login
echo   Press Ctrl+C to stop
echo ═══════════════════════════════════════════
echo.

cd frontend && npx vite --port 9173
