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
cd backend
python seed_db.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo   [!] ERROR: Seeding failed. Please check your Python environment.
    pause
    exit /b %ERRORLEVEL%
)
cd ..

:: 2. Launch Backend in a new window
echo   [*] Starting Backend server (FastAPI on :8000)...
start "AutoScheduler Backend" cmd /k "cd backend && uvicorn main:app --reload --port 8000"

:: 3. Launch Frontend in a new window
echo   [*] Starting Frontend server (Vite on :5173)...
start "AutoScheduler Frontend" cmd /k "cd frontend && npm install && npm run dev -- --port 5173"

echo.
echo   [+] ALL SERVERS STARTING...
echo   [+] Backend: http://localhost:8000/docs
echo   [+] Frontend: http://localhost:5173
echo.
echo   Leave this window open to keep track of the launch process.
echo   Press any key to open the browser...
pause > nul

start http://localhost:5173

exit
