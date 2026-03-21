@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════════
echo   WK-Hub Database Seeder
echo ═══════════════════════════════════════════
echo.
echo This will populate the database with comprehensive sample data
echo including all modules: models, fabrics, accessories, work orders,
echo invoices, purchase orders, employees, and more.
echo.

cd /d "%~dp0backend"

echo [1/2] Running seed script...
node seed.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Seeding failed! Make sure the database exists first.
    echo    Run reset.bat first if needed.
    pause
    exit /b 1
)

echo.
echo ═══════════════════════════════════════════
echo   Login Credentials (all passwords: 123456)
echo ═══════════════════════════════════════════
echo.
echo   Username      Role              Arabic
echo   ────────      ────              ──────
echo   admin         superadmin        مدير النظام
echo   manager1      manager           مدير
echo   accountant1   accountant        محاسبة
echo   production1   production        إنتاج
echo   hr1           hr                موارد بشرية
echo   viewer1       viewer            مشاهد
echo   viewer2       viewer            مشاهد
echo.
echo ═══════════════════════════════════════════
echo.
echo To start the system:
echo   1. cd backend ^&^& node server.js
echo   2. cd frontend ^&^& npx vite --port 9173
echo   3. Open http://localhost:9173
echo.
pause
