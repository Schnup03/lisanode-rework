@echo off
REM LisaNode Rework - Run Script
REM Starts the LisaNode sidecar with all required checks

echo ════════════════════════════════════════════════
echo   LisaNode Rework - Starting
echo ════════════════════════════════════════════════
echo.

REM Get WSL IP address
echo [1/4] Detecting WSL IP address...
for /f "tokens=*" %%i in ('wsl -e hostname -I 2^>nul') do set WSL_IP=%%i
if "%WSL_IP%"=="" (
    echo   ⚠ Could not detect WSL IP, using 192.168.2.43
    set WSL_IP=192.168.2.43
)
echo   ✓ WSL IP: %WSL_IP%

REM Check Node.js
echo [2/4] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   ❌ Node.js not found! Run install.bat first.
    pause
    exit /b 1
)
echo   ✓ Node.js ready

REM Check dependencies
echo [3/4] Checking dependencies...
if not exist node_modules (
    echo   ❌ Dependencies not installed! Run install.bat first.
    pause
    exit /b 1
)
echo   ✓ Dependencies ready

REM Check .env configuration
echo [4/4] Checking configuration...
if not exist .env (
    echo   ❌ .env not found! Run install.bat first.
    pause
    exit /b 1
)

REM Load .env and set variables
for /f "tokens=1,* delims==" %%a in ('findstr "GATEWAY_TOKEN" .env') do set GATEWAY_TOKEN=%%b
for /f "tokens=1,* delims==" %%a in ('findstr "GATEWAY_URL" .env') do set GATEWAY_URL_VAL=%%b
for /f "tokens=1,* delims==" %%a in ('findstr "NODE_NAME" .env') do set NODE_NAME=%%b
for /f "tokens=1,* delims==" %%a in ('findstr "CLIENT_ID" .env') do set CLIENT_ID=%%b

if "%GATEWAY_TOKEN%"=="" (
    echo   ❌ GATEWAY_TOKEN not set in .env!
    echo   Please edit .env and add your token.
    pause
    exit /b 1
)

REM Set default URL if not configured
if "%GATEWAY_URL_VAL%"=="" set GATEWAY_URL_VAL=ws://%WSL_IP%:18789

echo   ✓ Token: %GATEWAY_TOKEN:~0,8%...
echo   ✓ Gateway: %GATEWAY_URL_VAL%
echo   ✓ Node Name: %NODE_NAME%
echo.

REM Set environment variables and start
echo ════════════════════════════════════════════════
echo   Starting LisaNode...
echo ════════════════════════════════════════════════
echo.

set GATEWAY_URL=%GATEWAY_URL_VAL%
set GATEWAY_TOKEN=%GATEWAY_TOKEN%
set NODE_NAME=%NODE_NAME%
set CLIENT_ID=%CLIENT_ID%

node src/sidecar.mjs

echo.
echo LisaNode stopped.
pause