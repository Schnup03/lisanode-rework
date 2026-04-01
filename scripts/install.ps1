# LisaNode Rework - Windows Install Script
# Run as Administrator for best results
# Usage: .\install.ps1 -GatewayToken "your_token"

param(
    [Parameter(Mandatory=$false)]
    [string]$GatewayToken = "",
    [Parameter(Mandatory=$false)]
    [string]$GatewayUrl = "ws://127.0.0.1:18789",
    [Parameter(Mandatory=$false)]
    [string]$NodeName = "LisaNode-Windows"
)

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  LisaNode Rework v2.0 - Installer" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Write-Host "Admin rights: $($isAdmin)" -ForegroundColor $(if($isAdmin){'Green'}else{'Yellow'})

# Check Node.js
Write-Host "Checking Node.js..." -NoNewline
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host " OK ($nodeVersion)" -ForegroundColor Green
    } else {
        throw "Node not found"
    }
} catch {
    Write-Host " NOT FOUND" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Get install directory
$installDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$parentDir = Split-Path -Parent $installDir
Set-Location $parentDir
Write-Host "Install directory: $parentDir"

# Install dependencies
Write-Host "`nInstalling npm dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: npm install failed" -ForegroundColor Red
    exit 1
}

# Build
Write-Host "`nBuilding..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed" -ForegroundColor Red
    exit 1
}

# Create .env if it doesn't exist
$envFile = Join-Path $parentDir ".env"
if (-not (Test-Path $envFile)) {
    if ($GatewayToken -eq "") {
        Write-Host "`nGateway Token not provided." -ForegroundColor Yellow
        Write-Host "Please enter your OpenClaw Gateway Token:" -ForegroundColor Yellow
        $GatewayToken = Read-Host "Token"
    }
    @"
# LisaNode Rework Configuration
GATEWAY_TOKEN=$GatewayToken
GATEWAY_URL=$GatewayUrl
NODE_NAME=$NodeName
DEBUG=false
"@ | Out-File -FilePath $envFile -Encoding UTF8
    Write-Host "Created .env file" -ForegroundColor Green
} else {
    Write-Host ".env file already exists" -ForegroundColor Green
}

# Create startup shortcut
$startupDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$shortcutPath = Join-Path $startupDir "LisaNode.lnk"

Write-Host "`nCreating startup shortcut..." -ForegroundColor Cyan
try {
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($shortcutPath)
    $Shortcut.TargetPath = "cmd.exe"
    $Shortcut.Arguments = "/c set GATEWAY_TOKEN=your_token&& cd /d $parentDir && node dist\sidecar.js"
    $Shortcut.WorkingDirectory = $parentDir
    $Shortcut.Description = "LisaNode Rework - Windows Control Node"
    $Shortcut.Save()
    Write-Host "Startup shortcut created: $shortcutPath" -ForegroundColor Green
    Write-Host "NOTE: Edit the shortcut to set your GATEWAY_TOKEN" -ForegroundColor Yellow
} catch {
    Write-Host "Could not create shortcut: $_" -ForegroundColor Yellow
}

Write-Host "`n======================================" -ForegroundColor Green
Write-Host "  Installation complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Edit .env and set GATEWAY_TOKEN" -ForegroundColor White
Write-Host "  2. Run: npm run start" -ForegroundColor White
Write-Host "  3. Or run: scripts\start-sidecar.bat" -ForegroundColor White
Write-Host ""
Write-Host "To start automatically on login, the shortcut is in Startup." -ForegroundColor Yellow
Write-Host ""
