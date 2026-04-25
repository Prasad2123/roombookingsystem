@echo off
title RoomDesk - Room Management System
color 0E
cd /d "%~dp0"

echo.
echo  ==========================================
echo   RoomDesk - Room Management System
echo  ==========================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Node.js is not installed or not in PATH.
    echo  Download from: https://nodejs.org
    pause
    exit /b 1
)

:: Kill any old process on port 3000
echo  [*] Freeing port 3000 if in use...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000 "') do taskkill /PID %%P /F >nul 2>&1
timeout /t 1 /nobreak >nul

:: Start Node server in a new window (keep it visible so errors show)
echo  [1/2] Starting Node.js server...
start "RoomDesk Server" cmd /k node server.js

:: Wait for server to boot
timeout /t 3 /nobreak >nul

:: Open in browser
echo  [2/2] Opening app in browser...
start http://localhost:3000

echo.
echo  ==========================================
echo   Running at: http://localhost:3000
echo   Keep "RoomDesk Server" window open!
echo  ==========================================
echo.
pause
