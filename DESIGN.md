# LisaNode Rework - Complete Windows Control Node

## Overview

LisaNode Rework is a production-ready Windows desktop control node for OpenClaw. It consists of:
- **Node.js Sidecar** - Connects to OpenClaw Gateway via WebSocket Node Protocol, executes commands
- **Tauri GUI** (optional) - System tray UI for monitoring and control
- **PowerShell Engine** - Executes all Windows commands

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenClaw Gateway                         │
│                     (ws://127.0.0.1:18789)                  │
└─────────────────────────────┬───────────────────────────────┘
                              │ WebSocket (Node Protocol)
                              │
        ┌─────────────────────┴─────────────────────┐
        │          LisaNode Sidecar                 │
        │  ┌─────────────────────────────────────┐  │
        │  │  NodeProtocolClient (node.mjs)     │  │
        │  │  - WebSocket connection             │  │
        │  │  - Command routing                  │  │
        │  │  - Auto-reconnect                   │  │
        │  └─────────────────────────────────────┘  │
        │  ┌─────────────────────────────────────┐  │
        │  │  Command Handlers (commands/*.mjs)  │  │
        │  │  - window.*, mouse.*, keyboard.*   │  │
        │  │  - screen.*, process.*, system.*    │  │
        │  │  - chrome.*, network.*, app.*       │  │
        │  └─────────────────────────────────────┘  │
        │  ┌─────────────────────────────────────┐  │
        │  │  PowerShell Engine (ps-engine.mjs)  │  │
        │  │  - Safe command execution           │  │
        │  │  - Output parsing                   │  │
        │  │  - Error handling                   │  │
        │  └─────────────────────────────────────┘  │
        └─────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────┐
        │              Windows PowerShell             │
        │  - Native API calls (user32, kernel32)     │
        │  - WMI/CIM queries                         │
        │  - Chrome DevTools Protocol                │
        │  - WSL commands                            │
        └─────────────────────────────────────────────┘
```

## Node Protocol Flow

1. Gateway sends `connect.challenge` event with nonce
2. Sidecar responds with `connect` request (token auth)
3. Gateway responds with `connect.ok`
4. Sidecar is registered as `node` role
5. Gateway sends `node.invoke` events for commands
6. Sidecar executes and responds with `node.invoke.response`

## Command Categories

### Window Management (13 commands)
- `window.list` - List all windows
- `window.listall` - List with memory/size info
- `window.find` - Find window by title
- `window.focus` - Bring window to front
- `window.minimize` - Minimize window
- `window.maximize` - Maximize window
- `window.restore` - Restore window
- `window.close` - Close window
- `window.move` - Move window to position
- `window.resize` - Resize window

### Mouse Control (5 commands)
- `mouse.move` - Move cursor
- `mouse.click` - Click at position
- `mouse.rightclick` - Right-click
- `mouse.doubleclick` - Double-click
- `mouse.scroll` - Scroll up/down

### Keyboard Control (4 commands)
- `keyboard.type` - Type text
- `keyboard.hotkey` - Send hotkey
- `keyboard.press` - Press single key
- `keyboard.write` - Write with special char support

### Screen Capture (3 commands)
- `screen.capture` - Full screenshot (base64 PNG)
- `screen.region` - Capture region
- `screen.window` - Capture specific window

### Process Management (4 commands)
- `process.list` - List processes
- `process.kill` - Kill by PID
- `process.info` - Process details
- `process.start` - Start process

### System Info (10 commands)
- `system.info` - Computer info
- `system.cpu` - CPU details + load
- `system.memory` - RAM usage
- `system.disk` - Disk space
- `system.gpu` - GPU info
- `system.bios` - BIOS info
- `system.uptime` - System uptime
- `system.display` - Monitor info

### Chrome/Firefox Control (6 commands)
- `chrome.tabs` - List tabs
- `chrome.findtab` - Find tab by URL/title
- `chrome.navigate` - Open URL
- `chrome.activeurl` - Get active tab
- `firefox.tabs` - List Firefox tabs
- `firefox.navigate` - Open Firefox URL

### Network (6 commands)
- `network.info` - IP config
- `network.ping` - Ping host
- `network.dns` - DNS lookup
- `network.flushdns` - Flush DNS cache
- `network.connections` - Active connections
- `network.wifi` - WiFi info

### App Management (5 commands)
- `app.list` - List installed apps
- `app.install` - Install via winget
- `app.uninstall` - Uninstall app
- `app.search` - Search winget
- `app.update` - Update apps

### Windows Updates (3 commands)
- `windowsupdate.status` - Update status
- `windowsupdate.list` - List pending
- `windowsupdate.install` - Install updates

### WSL Integration (4 commands)
- `wsl.list` - List distros
- `wsl.info` - WSL info
- `wsl.run` - Run command in WSL
- `wsl.ssh` - SSH to WSL

### PowerShell (2 commands)
- `powershell.exec` - Execute PS command
- `powershell.script` - Execute PS script file

### Clipboard (2 commands)
- `clipboard.get` - Read clipboard
- `clipboard.set` - Write clipboard

### Services (4 commands)
- `service.list` - List services
- `service.start` - Start service
- `service.stop` - Stop service
- `service.restart` - Restart service

### Device Management (3 commands)
- `device.list` - List PnP devices
- `device.enable` - Enable device
- `device.disable` - Disable device

### Power Management (4 commands)
- `power.lock` - Lock workstation
- `power.sleep` - Sleep
- `power.hibernate` - Hibernate
- `power.shutdown` - Shutdown
- `power.restart` - Restart

### Registry (2 commands)
- `registry.read` - Read registry value
- `registry.write` - Write registry value

### Tasks (3 commands)
- `task.list` - List scheduled tasks
- `task.run` - Run task
- `task.stop` - Stop task

### Event Log (2 commands)
- `eventlog.system` - System events
- `eventlog.application` - App events

### Troubleshooting (3 commands)
- `troubleshoot.sfc` - Run sfc /scannow
- `troubleshoot.dism` - Run DISM
- `troubleshoot.health` - Full health check

### Utils (4 commands)
- `notify` - Send toast notification
- `env.list` - List env variables
- `driver.list` - List drivers
- `capabilities` - List all commands

## Authentication

Token-based authentication via `GATEWAY_TOKEN` environment variable.
The token is sent in the `connect` request's `auth.token` field.

## Error Handling

All commands return:
```json
{
  "success": true,
  "result": { ... }
}
```
Or on error:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## Logging

- Log file: `lisanode-sidecar.log` (rotated daily, max 7 files)
- Log levels: DEBUG, INFO, WARN, ERROR
- Debug mode: `DEBUG=true` env var

## Installation

### Option 1: npm install
```bash
cd lisanode-rework
npm install
npm run build
node dist/sidecar.js
```

### Option 2: Windows install script
```powershell
irm https://raw.githubusercontent.com/.../install.ps1 | iex
```

## Configuration

Environment variables:
- `GATEWAY_URL` - Gateway WebSocket URL (default: ws://127.0.0.1:18789)
- `GATEWAY_TOKEN` - Gateway auth token (required)
- `NODE_NAME` - Display name (default: LisaNode-Windows)
- `LOG_FILE` - Log file path
- `DEBUG` - Enable debug logging
- `IPC_PORT` - IPC HTTP server port (default: 18888)
