@echo off
title WK-Hub Build
echo ========================================
echo    Building WK-Hub Desktop App
echo ========================================
echo.

:: Install deps if needed
if not exist "node_modules" (
    echo Installing root dependencies...
    npm install
)
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend && npm install && cd ..
)
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend && npm install && cd ..
)

echo.
echo Building frontend...
cd frontend && npm run build && cd ..

echo.
echo Building Electron app...
set CSC_IDENTITY_AUTO_DISCOVERY=false
npx electron-builder --win

echo.
echo ========================================
echo   Build complete!
echo   Output: dist-electron\
echo ========================================
pause
