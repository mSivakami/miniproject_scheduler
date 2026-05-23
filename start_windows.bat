@echo off
title AutoScheduler
color 0B
echo.
echo  =====================================================
echo   AutoScheduler — Starting up...
echo  =====================================================
echo.

if not exist "node_modules" (
    echo  [!] It looks like you haven't run setup yet.
    echo      Please double-click setup.bat first.
    echo.
    pause
    exit /b 1
)

echo  Starting Frontend and Backend concurrently...
echo  A browser window will open automatically.
echo.
echo  Keep this window open to keep the servers running.
echo  To stop, press Ctrl+C or close this window.
echo.

:: Open the browser slightly delayed (it takes a few seconds to start)
:: The ping command is a simple way to pause for ~3 seconds
ping 127.0.0.1 -n 4 > nul
start http://localhost:5173

:: Run the dev server
call npm run dev
