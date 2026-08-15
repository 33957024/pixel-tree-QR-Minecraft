@echo off
setlocal
cd /d "%~dp0"

rem ---- Check Node.js ----
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install it from https://nodejs.org/
    pause
    exit /b 1
)

rem ---- Install dependencies on first run ----
if not exist "node_modules" (
    echo [1/2] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed. Check your network and retry.
        pause
        exit /b 1
    )
)

rem ---- Port: default 3000. Override with: start.bat 8080 ----
set PORT=3000
if not "%~1"=="" set PORT=%~1

echo [2/2] Starting pixel-tree QR server...
echo.
echo    UI:    http://localhost:%PORT%/
echo    Stop:  press Ctrl+C
echo.

node index.js serve

echo.
echo ============================================
echo  Server stopped.
echo  If you saw an error above, please tell me what it says.
echo  Tip: port in use? Try another port, e.g. start.bat 8080
echo ============================================
pause
endlocal
