@echo off
title WK-Hub Factory System
echo ========================================
echo    WK-Hub - Factory Management System
echo ========================================
echo.

:: Check if node_modules exist
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend && npm install && cd ..
)
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend && npm install && cd ..
)

:: Seed DB if missing
if not exist "backend\wk-hub.db" (
    echo Seeding database...
    cd backend && node seed.js && cd ..
)

echo Starting backend server on port 3001...
start /B cmd /C "cd backend && node server.js"

:: Wait a moment for backend to be ready
timeout /t 2 /nobreak >nul

echo Starting frontend on port 5173...
echo.
echo ========================================
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:5173
echo ========================================
echo   Press Ctrl+C to stop
echo ========================================
echo.

cd frontend && npx vite
