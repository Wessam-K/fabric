@echo off
REM ═══════════════════════════════════════════
REM  WK-Hub Health Check
REM ═══════════════════════════════════════════

set PORT=9002
echo [CHECK] Checking WK-Hub on port %PORT%...
echo.

curl -s http://localhost:%PORT%/api/health 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Server is NOT responding on port %PORT%
    exit /b 1
)

echo.
echo.
echo [OK] Server is healthy.
