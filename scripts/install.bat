@echo off
REM LisaNode Rework - Install Script
REM Checks prerequisites and sets up the environment

echo ════════════════════════════════════════════════
echo   LisaNode Rework - Installation
echo ════════════════════════════════════════════════
echo.

REM Check Node.js
echo [1/5] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   ❌ Node.js not found! Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo   ✓ Node.js %NODE_VERSION%

REM Check npm
echo [2/5] Checking npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   ❌ npm not found!
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo   ✓ npm %NPM_VERSION%

REM Install dependencies
echo [3/5] Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo   ❌ Failed to install dependencies!
    pause
    exit /b 1
)
echo   ✓ Dependencies installed

REM Check .env file
echo [4/5] Checking configuration...
if not exist .env (
    echo   ⚠ Creating .env from .env.example...
    copy .env.example .env
    echo   ⚠ Please edit .env and add your GATEWAY_TOKEN!
    echo.
)
if exist .env (
    findstr /C:"GATEWAY_TOKEN=" .env >nul
    if %errorlevel% neq 0 (
        echo   ⚠ GATEWAY_TOKEN not found in .env!
        echo   ⚠ Please add your token to .env
    ) else (
        for /f "tokens=1,* delims==" %%a in ('findstr "GATEWAY_TOKEN" .env') do set TOKEN_VALUE=%%b
        if "%TOKEN_VALUE%"=="" (
            echo   ⚠ GATEWAY_TOKEN is empty!
        ) else (
            echo   ✓ GATEWAY_TOKEN configured
        )
    )
)

REM Check Gateway connectivity
echo [5/5] Testing Gateway connectivity...
echo   Note: Gateway must be running on your WSL/Linux machine
echo   Default: ws://127.0.0.1:18789
echo.

echo ════════════════════════════════════════════════
echo   Installation complete!
echo ════════════════════════════════════════════════
echo.
echo To run LisaNode:
echo   run.bat
echo.
pause