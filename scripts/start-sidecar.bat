@echo off
REM LisaNode Rework - Start Script for Windows
REM Usage: start-sidecar.bat [GATEWAY_TOKEN]

setlocal

REM Get script directory
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%.."

REM Check for Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Download from: https://nodejs.org
    pause
    exit /b 1
)

REM Check for GATEWAY_TOKEN
if "%GATEWAY_TOKEN%"=="" (
    if not "%1"=="" (
        set "GATEWAY_TOKEN=%1"
    ) else (
        echo ERROR: GATEWAY_TOKEN environment variable not set
        echo.
        echo Usage:
        echo   set GATEWAY_TOKEN=your_token_here
        echo   start-sidecar.bat
        echo.
        echo   Or:
        echo   start-sidecar.bat your_token_here
        pause
        exit /b 1
    )
)

echo ====================================
echo   LisaNode Rework v2.0
echo ====================================
echo Gateway: %GATEWAY_URL%
echo Token:   %GATEWAY_TOKEN:~0,8%...
echo.

REM Check if dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo ERROR: npm install failed
        pause
        exit /b 1
    )
)

REM Build if needed
if not exist "dist" (
    echo Building...
    call npm run build
)

echo Starting sidecar...
echo.

node dist/sidecar.js

if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Sidecar exited with code %ERRORLEVEL%
    pause
)
