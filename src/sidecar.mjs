/**
 * LisaNode Rework - Main Sidecar Entry Point
 * Production Windows Control Node for OpenClaw
 */
import { NodeProtocolClient } from './node-protocol.mjs';
import { allCommands, commandList } from './commands/index.mjs';
import logger from './utils/logger.mjs';
import http from 'http';
import https from 'https';
import { readFileSync, existsSync } from 'fs';

// Load .env if present
try {
  const envFile = new URL('.env', import.meta.url);
  if (existsSync(envFile)) {
    const envContent = readFileSync(envFile, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = value;
        }
      }
    }
  }
} catch { /* ignore */ }

// Configuration from environment
const CONFIG = {
  gateway: process.env.GATEWAY_URL || 'ws://127.0.0.1:18789',
  token: process.env.GATEWAY_TOKEN || '',
  displayName: process.env.NODE_NAME || 'LisaNode-Windows',
  clientId: process.env.CLIENT_ID || 'lisanode-rework',
  clientVersion: '2.0.0',
  role: 'node',
  logFile: process.env.LOG_FILE || './lisanode-sidecar.log',
  ipcPort: parseInt(process.env.IPC_PORT || '18888', 10),
  autoReconnect: true,
  maxReconnectAttempts: Infinity,
  reconnectIntervalMs: 3000,
};

// Validate token
if (!CONFIG.token) {
  console.error('ERROR: GATEWAY_TOKEN environment variable is required');
  console.error('Set it with: export GATEWAY_TOKEN=your_token_here');
  process.exit(1);
}

let nodeClient = null;

// ============== IPC HTTP SERVER ==============
function startIPCServer() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end();
      return;
    }

    // Status endpoint
    if (req.method === 'GET' && (req.url === '/status' || req.url === '/')) {
      res.writeHead(200);
      res.end(JSON.stringify({
        connected: nodeClient?.isConnected || false,
        commandCount: commandList.length,
        displayName: CONFIG.displayName,
        version: CONFIG.clientVersion,
        gateway: CONFIG.gateway,
        tokenSet: !!CONFIG.token,
        tokenPrefix: CONFIG.token ? CONFIG.token.slice(0, 8) + '...' : '',
        uptime: process.uptime()
      }));
      return;
    }

    // Test endpoint
    if (req.method === 'GET' && req.url === '/test') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
      return;
    }

    // Debug endpoint
    if (req.method === 'GET' && req.url === '/debug') {
      res.writeHead(200);
      res.end(JSON.stringify({
        config: { gateway: CONFIG.gateway, tokenSet: !!CONFIG.token, logFile: CONFIG.logFile },
        node: { connected: nodeClient?.isConnected || false, methods: nodeClient?.availableMethods || [] },
        commands: commandList.slice(0, 50)
      }));
      return;
    }

    // Command execution endpoint
    if (req.method === 'POST' && req.url === '/command') {
      let body = '';
      const MAX_SIZE = 1024 * 1024; // 1MB
      req.on('data', chunk => {
        body += chunk;
        if (body.length > MAX_SIZE) { res.writeHead(413); res.end(JSON.stringify({ success: false, error: 'Body too large' })); }
      });
      req.on('end', async () => {
        try {
          const { command, params } = JSON.parse(body);
          const handler = allCommands[command];
          if (!handler) {
            res.writeHead(404);
            res.end(JSON.stringify({ success: false, error: `Unknown command: ${command}`, available: commandList }));
            return;
          }
          const result = await handler(params || {});
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, result }));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // Run a command via gateway (for testing)
    if (req.method === 'POST' && req.url === '/run') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { command, params } = JSON.parse(body);
          if (!nodeClient?.isConnected) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Not connected to gateway' }));
            return;
          }
          const result = await nodeClient.sendRequest('node.invoke', { command, params: params || {} });
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, result }));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found', available: ['GET /status', 'GET /test', 'GET /debug', 'POST /command', 'POST /run'] }));
  });

  server.listen(CONFIG.ipcPort, () => {
    console.log(`IPC server listening on http://localhost:${CONFIG.ipcPort}`);
    console.log(`  GET  /status  - Node status`);
    console.log(`  GET  /test    - Simple test`);
    console.log(`  GET  /debug   - Debug info`);
    console.log(`  POST /command - Execute command locally`);
    console.log(`  POST /run     - Execute via gateway`);
  });

  server.on('error', (err) => {
    console.error('IPC server error:', err.message);
  });
}

// ============== MAIN ==============
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  LisaNode Rework v2.0 - Windows Control Node');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Gateway:    ${CONFIG.gateway}`);
  console.log(`  Node Name:   ${CONFIG.displayName}`);
  console.log(`  Commands:    ${commandList.length}`);
  console.log(`  IPC Port:    ${CONFIG.ipcPort}`);
  console.log('');

  // Register all command handlers
  for (const [command, handler] of Object.entries(allCommands)) {
    logger.debug(`Registered command: ${command}`);
  }
  console.log(`Registered ${commandList.length} commands`);

  // Start IPC server
  startIPCServer();

  // Create node client
  nodeClient = new NodeProtocolClient({
    url: CONFIG.gateway,
    token: CONFIG.token,
    displayName: CONFIG.displayName,
    clientId: CONFIG.clientId,
    clientVersion: CONFIG.clientVersion,
    role: CONFIG.role,
    capabilities: commandList,
    autoReconnect: CONFIG.autoReconnect,
    maxReconnectAttempts: CONFIG.maxReconnectAttempts,
    reconnectIntervalMs: CONFIG.reconnectIntervalMs,
  });

  // Register all command handlers
  for (const [command, handler] of Object.entries(allCommands)) {
    nodeClient.onCommand(command, handler);
  }

  // Connect to gateway
  console.log(`Connecting to Gateway...`);
  logger.info(`Connecting to ${CONFIG.gateway}`);

  try {
    await nodeClient.connect();
    console.log(`\n✅ Connected to Gateway!`);
    console.log(`   Available methods: ${nodeClient.availableMethods.length}`);
    if (nodeClient.availableMethods.length > 0) {
      console.log(`   Sample: ${nodeClient.availableMethods.slice(0, 5).join(', ')}...`);
    }
    logger.info('Node registered successfully');
  } catch (err) {
    console.error(`\n❌ Connection failed: ${err.message}`);
    logger.error('Failed to connect to gateway', { error: err.message });
    console.error('\nTroubleshooting:');
    console.error('  1. Is the Gateway running?');
    console.error('  2. Is the GATEWAY_TOKEN correct?');
    console.error('  3. Is the network reachable?');
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n${signal} received, shutting down...`);
    logger.info(`Shutdown signal: ${signal}`);
    nodeClient?.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  console.log(`\n📡 Sidecar running. Press Ctrl+C to stop.\n`);
}

// Run
main().catch(err => {
  console.error('Fatal error:', err);
  logger.error('Fatal error', { error: err.message, stack: err.stack });
  process.exit(1);
});
