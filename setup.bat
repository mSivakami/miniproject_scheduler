@echo off
setlocal EnableDelayedExpansion
title AutoScheduler — First-Time Setup
color 0A

echo.
echo  =====================================================
echo   AutoScheduler — First-Time Setup
echo  =====================================================
echo.

:: ── 1. Check Node.js ──────────────────────────────────
echo  [1/4] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERROR] Node.js is NOT installed.
    echo  Please download it from: https://nodejs.org
    echo  Then re-run this setup.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo        Found Node.js %NODE_VER%

:: ── 2. Check Python ───────────────────────────────────
echo  [2/4] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERROR] Python is NOT installed.
    echo  Please download it from: https://python.org
    echo  Make sure to check "Add Python to PATH" during install.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version') do set PY_VER=%%v
echo        Found %PY_VER%

:: ── 3. Create .env if missing ─────────────────────────
echo  [3/4] Checking environment file...
if not exist ".env" (
    echo        .env not found — copying from .env.example...
    copy ".env.example" ".env" >nul
    echo        .env created. You can edit it any time.
) else (
    echo        .env already exists. Skipping.
)

:: ── 4. Install all dependencies ───────────────────────
echo  [4/4] Installing dependencies (this may take a few minutes)...
echo.
echo  --- Installing root Node packages (concurrently) ---
call npm install
if errorlevel 1 goto :npm_error

echo.
echo  --- Installing frontend packages ---
cd frontend
call npm install
if errorlevel 1 (
    cd ..
    goto :npm_error
)
cd ..

echo.
echo  --- Installing Python backend packages ---
cd backend
pip install -r requirements.txt
if errorlevel 1 (
    cd ..
    goto :pip_error
)
cd ..

:: ── Done ──────────────────────────────────────────────
echo.
echo  =====================================================
echo   Setup complete!
echo  =====================================================
echo.
echo   Next step: double-click  start.bat  to run the app.
echo.
pause
exit /b 0

:npm_error
echo.
echo  [ERROR] npm install failed. Check the output above.
pause
exit /b 1

:pip_error
echo.
echo  [ERROR] pip install failed. Check the output above.
pause
exit /b 1
