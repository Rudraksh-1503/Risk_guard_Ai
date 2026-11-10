@echo off
echo ========================================
echo  Risk Guard AI - Frontend Setup
echo ========================================

cd /d "%~dp0frontend"

echo.
echo [1/2] Installing npm packages...
npm install

echo.
echo [2/2] Starting React app on http://localhost:3000
npm start

pause
