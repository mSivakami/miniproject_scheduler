@echo off
TITLE AutoScheduler — Integrated Startup Launcher
COLOR 0B

echo.
echo   ================================================
echo     AutoScheduler — Integrated Startup Launcher
echo   ================================================
echo.

:: 1. Seeding Data
echo   [*] Seeding demo data into SQLite...
if exist .venv\Scripts\python.exe (
    set PY_EXE=.venv\Scripts\python.exe
) else (
    set PY_EXE=python
)

cd backend
%PY_EXE% seed_db.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo   [!] ERROR: Seeding failed. Please check your Python environment.
    pause
    exit /b %ERRORLEVEL%
)
cd ..

:: 2. Launch Backend
echo   [*] Starting Backend server (FastAPI on :8000)...
start "AutoScheduler_Backend" cmd /c "cd backend && %PY_EXE% -m uvicorn main:app --reload --port 8000"

:: 3. Launch Frontend
echo   [*] Starting Frontend server (Vite on :5173)...
start "AutoScheduler_Frontend" cmd /c "cd frontend && npm run dev -- --port 5173"

echo.
echo   [+] ALL SERVERS STARTING...
echo   [+] Backend: http://localhost:8000/docs
echo   [+] Frontend: http://localhost:5173
echo.
echo   [*] Opening browser in 3 seconds...
timeout /t 3 /nobreak > nul
start http://localhost:5173

echo.
echo   ================================================
echo     TYPE 'CLOSE' AND PRESS ENTER TO SHUT DOWN
echo   ================================================
:loop
set /p input="> "
if /i "%input%"=="CLOSE" (
    echo   [*] Shutting down servers...
    taskkill /F /FI "WINDOWTITLE eq AutoScheduler_*" /T > nul 2>&1
    taskkill /F /IM uvicorn.exe /T > nul 2>&1
    taskkill /F /IM node.exe /F /T > nul 2>&1
    echo   [+] Servers stopped. Goodbye!
    timeout /t 2 > nul
    exit
)
echo   Unknown command. Type 'CLOSE' to exit.
goto loop
