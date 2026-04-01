# LisaNode Rework - Production Windows Control Node

**Version:** 2.0.0 | **Platform:** Windows | **Protocol:** OpenClaw Node

Complete Windows desktop control node for OpenClaw. Control windows, mouse, keyboard, processes, screens, browsers, and more.

---

## Features

- **78 Commands** across 8 categories
- **Window Management** - list, focus, minimize, maximize, close, move, resize
- **Mouse Control** - move, click, right-click, double-click, scroll
- **Keyboard Control** - type, hotkeys, key press
- **Screen Capture** - full screen, window, multi-monitor
- **Process Management** - list, kill, info, start
- **System Info** - CPU, RAM, GPU, disk, uptime, BIOS
- **Network** - ping, DNS, connections, WiFi
- **Browser Control** - Chrome/Firefox DevTools (tabs, navigate)
- **App Management** - winget install/uninstall
- **Windows Updates** - list, install
- **WSL Integration** - run commands in WSL
- **PowerShell Execution** - run arbitrary PS commands
- **And more...**

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Gateway Token

```bash
# Set your gateway token
export GATEWAY_TOKEN=your_gateway_token_here

# Or create a .env file
echo "GATEWAY_TOKEN=your_token_here" > .env
echo "GATEWAY_URL=ws://127.0.0.1:18789" >> .env
echo "NODE_NAME=LisaNode-Windows" >> .env
```

### 3. Run

```bash
# Development
npm run dev

# Production
npm run build
node dist/sidecar.js
```

---

## Commands Reference

### Window Management
| Command | Description |
|---------|-------------|
| `window.list` | List all windows |
| `window.listall` | List with memory/CPU info |
| `window.find` | Find window by title |
| `window.active` | Get active window title |
| `window.focus` | Bring window to front |
| `window.minimize` | Minimize window |
| `window.maximize` | Maximize window |
| `window.restore` | Restore window |
| `window.close` | Close window |
| `window.move` | Move window to position |
| `window.resize` | Resize window |

### Mouse
| Command | Description |
|---------|-------------|
| `mouse.move x=100,y=200` | Move cursor |
| `mouse.position` | Get cursor position |
| `mouse.click` | Click (left) |
| `mouse.click button=right` | Right-click |
| `mouse.doubleclick` | Double-click |
| `mouse.scroll amount=3` | Scroll |

### Keyboard
| Command | Description |
|---------|-------------|
| `keyboard.type text=Hello` | Type text |
| `keyboard.hotkey keys=^c` | Send hotkey |
| `keyboard.press key=ENTER` | Press key |

### Screen
| Command | Description |
|---------|-------------|
| `screen.capture` | Full screenshot (base64) |
| `screen.window title=Chrome` | Window screenshot |
| `screen.monitors` | List monitors |

### Process
| Command | Description |
|---------|-------------|
| `process.list` | List processes |
| `process.kill pid=1234` | Kill process |
| `process.info pid=1234` | Process details |
| `process.start name=notepad` | Start process |

### System
| Command | Description |
|---------|-------------|
| `system.info` | Computer info |
| `system.cpu` | CPU details |
| `system.memory` | RAM usage |
| `system.disk` | Disk space |
| `system.gpu` | GPU info |
| `system.uptime` | System uptime |

### Network
| Command | Description |
|---------|-------------|
| `network.info` | IP config |
| `network.ping host=google.com` | Ping host |
| `network.dns domain=google.com` | DNS lookup |
| `network.connections` | Active connections |
| `network.flushdns` | Flush DNS cache |

### Browser (Chrome DevTools)
| Command | Description |
|---------|-------------|
| `chrome.tabs` | List tabs |
| `chrome.findtab url=github.com` | Find tab |
| `chrome.navigate url=https://...` | Open URL |
| `chrome.activeurl` | Get active tab |

### Apps (winget)
| Command | Description |
|---------|-------------|
| `app.list` | List installed apps |
| `app.install package=VLC` | Install app |
| `app.uninstall package=VLC` | Uninstall app |
| `app.search package=firefox` | Search winget |

### Windows Updates
| Command | Description |
|---------|-------------|
| `windowsupdate.status` | Update status |
| `windowsupdate.list` | Pending updates |
| `windowsupdate.install` | Install all updates |

### PowerShell
| Command | Description |
|---------|-------------|
| `powershell.exec command=Get-Date` | Run PS command |
| `notify title=Hi message=Hello` | Toast notification |

### Utils
| Command | Description |
|---------|-------------|
| `ping` | Node ping test |
| `clipboard.get` | Read clipboard |
| `clipboard.set text=Hello` | Write clipboard |
| `power.lock` | Lock workstation |
| `power.restart` | Restart PC |
| `power.shutdown` | Shutdown PC |

---

## IPC HTTP API

When running, the sidecar exposes an HTTP API on port 18888:

```bash
# Node status
curl http://localhost:18888/status

# Execute command locally (bypasses gateway)
curl -X POST http://localhost:18888/command \
  -H "Content-Type: application/json" \
  -d '{"command":"window.list","params":{}}'

# Execute via gateway
curl -X POST http://localhost:18888/run \
  -H "Content-Type: application/json" \
  -d '{"command":"system.info","params":{}}'
```

---

## Troubleshooting

### "Connection failed: Auth failed"
- Check that `GATEWAY_TOKEN` is correct
- Token must match the gateway's configured token

### "Node registered successfully" but commands don't work
- Check that commands are in the available methods list
- Check gateway logs: `openclaw gateway logs`

### Screen capture returns error
- Ensure temp directory is writable: `C:\Windows\Temp\`

### Browser commands don't work
- Chrome must be running with `--remote-debugging-port=9222`
- Firefox must have `devtools.debugger.remote-enabled` enabled

---

## Architecture

```
lisanode-rework/
├── src/
│   ├── sidecar.mjs         # Main entry point
│   ├── node-protocol.mjs  # OpenClaw WebSocket protocol
│   ├── ps-engine.mjs      # PowerShell execution
│   ├── logger.mjs         # Logging
│   ├── commands/
│   │   ├── index.mjs      # Command registry
│   │   ├── window.mjs     # Window commands
│   │   ├── mouse.mjs      # Mouse/keyboard commands
│   │   ├── screen.mjs     # Screen capture
│   │   ├── system.mjs     # System/process/PS
│   │   ├── network.mjs    # Network/apps/services
│   │   └── browser.mjs    # Chrome/Firefox CDP
├── scripts/
│   └── build.mjs          # Build script
├── package.json
└── README.md
```

---

## Security Notes

- Token authentication only - no device signatures
- PowerShell commands are sandboxed via the sidecar
- Auto-reconnect with exponential backoff
- Log rotation (7 days max)

---

**Built with ❤️ by Lisa Nova for Stefan**
