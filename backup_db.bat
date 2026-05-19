@echo off
setlocal EnableDelayedExpansion
title AutoScheduler — Backup Database
color 0E

echo.
echo  =====================================================
echo   AutoScheduler — Backup Database
echo  =====================================================
echo.

set DB_PATH=backend\app.db
set BACKUP_DIR=backups

if not exist "%DB_PATH%" (
    echo  [ERROR] Database file not found at %DB_PATH%.
    echo          Have you run the app yet?
    echo.
    pause
    exit /b 1
)

if not exist "%BACKUP_DIR%" (
    mkdir "%BACKUP_DIR%"
)

:: Get current date and time
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set YYYY=%datetime:~0,4%
set MM=%datetime:~4,2%
set DD=%datetime:~6,2%
set HH=%datetime:~8,2%
set MIN=%datetime:~10,2%
set SEC=%datetime:~12,2%

set BACKUP_FILE=%BACKUP_DIR%\app_%YYYY%%MM%%DD%_%HH%%MIN%%SEC%.db

echo  Creating backup...
copy "%DB_PATH%" "%BACKUP_FILE%" >nul

if errorlevel 1 (
    echo.
    echo  [ERROR] Failed to create backup.
    echo.
) else (
    echo.
    echo  [SUCCESS] Backup created successfully!
    echo            Saved as: %BACKUP_FILE%
    echo.
)

pause
exit /b 0
