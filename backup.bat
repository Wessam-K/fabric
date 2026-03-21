@echo off
REM ═══════════════════════════════════════════
REM  WK-Hub Database Backup Script
REM ═══════════════════════════════════════════

set DBPATH=%~dp0backend\wk-hub.db
set BACKUPDIR=%~dp0backups
set TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUPFILE=%BACKUPDIR%\wk-hub_%TIMESTAMP%.db

if not exist "%DBPATH%" (
    echo [ERROR] Database not found at %DBPATH%
    exit /b 1
)

if not exist "%BACKUPDIR%" mkdir "%BACKUPDIR%"

echo [BACKUP] Copying database...
copy /Y "%DBPATH%" "%BACKUPFILE%" >nul

if %ERRORLEVEL% EQU 0 (
    echo [OK] Backup saved to: %BACKUPFILE%
    
    REM Keep only last 10 backups
    for /f "skip=10 delims=" %%f in ('dir /b /o-d "%BACKUPDIR%\wk-hub_*.db" 2^>nul') do (
        del "%BACKUPDIR%\%%f"
        echo [CLEANUP] Removed old backup: %%f
    )
) else (
    echo [ERROR] Backup failed!
    exit /b 1
)

echo [DONE] Backup complete.
