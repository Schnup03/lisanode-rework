/**
 * NodeProtocolClient - OpenClaw Gateway Node Protocol
 * Handles WebSocket connection, authentication, and command routing
 */
import WebSocket from 'ws';
import logger from './utils/logger.mjs';

const PROTOCOL_VERSION = 3;
const DEFAULT_SCOPES = [
  'node.invoke',
  'node.control',
  'operator.read',
  'operator.write'
];

export class NodeProtocolClient {
  constructor(options = {}) {
    this.options = {
      url: options.url || 'ws://127.0.0.1:18789',
      token: options.token,
      displayName: options.displayName || 'LisaNode-Windows',
      capabilities: options.capabilities || [],
      clientId: options.clientId || 'lisanode-rework',
      clientVersion: options.clientVersion || '2.0.0',
      role: options.role || 'node',
      scopes: options.scopes || DEFAULT_SCOPES,
      autoReconnect: options.autoReconnect !== false,
      reconnectIntervalMs: options.reconnectIntervalMs || 2000,
      maxReconnectDelayMs: options.maxReconnectDelayMs || 60000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 999999,
      connectTimeoutMs: options.connectTimeoutMs || 30000,
      ...options
    };

    this.ws = null;
    this.pendingRequests = new Map();
    this.reconnectAttempts = 0;
    this._isConnected = false;
    this._shouldReconnect = true;
    this._availableMethods = [];
    this.requestId = 0;
    this.commandHandlers = new Map();
    this.connectResolve = null;
    this.connectReject = null;
    this._connectTimeout = null;
    this._challengeNonce = null;
  }

  get isConnected() {
    return this._isConnected;
  }

  get availableMethods() {
    return this._availableMethods;
  }

  /** Register a command handler */
  onCommand(command, handler) {
    this.commandHandlers.set(command, handler);
  }

  /** Connect to gateway and perform node handshake */
  async connect() {
    this._shouldReconnect = true;
    this.reconnectAttempts = 0;
    return this._doConnect();
  }

  _doConnect() {
    return new Promise((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;

      logger.info(`Connecting to Gateway: ${this.options.url}`);

      // Set connect timeout
      this._connectTimeout = setTimeout(() => {
        if (!this._isConnected) {
          this.ws?.close();
          reject(new Error('Connection timeout'));
        }
      }, this.options.connectTimeoutMs);

      try {
        this.ws = new WebSocket(this.options.url);
      } catch (err) {
        clearTimeout(this._connectTimeout);
        reject(err);
        return;
      }

      this.ws.on('open', this._onOpen.bind(this));
      this.ws.on('message', this._onMessage.bind(this));
      this.ws.on('error', this._onError.bind(this));
      this.ws.on('close', this._onClose.bind(this));
    });
  }

  _onOpen() {
    logger.info('WebSocket opened, waiting for challenge...');
  }

  _onMessage(event) {
    let data;
    try {
      // Handle both event.data and raw event (cross-platform compatibility)
      const rawData = event.data || event;
      if (!rawData) {
        logger.debug('Empty message received, skipping');
        return;
      }
      data = JSON.parse(String(rawData));
    } catch (e) {
      logger.warn('Failed to parse message', { raw: String(rawData).slice(0, 200) });
      return;
    }

    // Route by type
    if (data.type === 'event') {
      if (data.event === 'connect.challenge') {
        this._handleChallenge(data.payload);
      } else if (data.event === 'node.invoke') {
        this._handleNodeInvoke(data.payload);
      } else {
        logger.debug('Unhandled event', { event: data.event, payload: data.payload });
      }
    } else if (data.type === 'res') {
      this._handleResponse(data);
    } else if (data.type === 'req') {
      this._handleRequest(data);
    }
  }

  _handleChallenge(payload) {
    logger.debug('Received connect.challenge', { payload });
    this._challengeNonce = payload?.nonce;

    // Build connect request with token auth
    const req = {
      type: 'req',
      id: this._nextId(),
      method: 'connect',
      params: {
        minProtocol: PROTOCOL_VERSION,
        maxProtocol: PROTOCOL_VERSION,
        client: {
          id: this.options.clientId,
          version: this.options.clientVersion,
          platform: 'win32',
          mode: 'backend'
        },
        role: this.options.role,
        scopes: this.options.scopes,
        caps: this.options.capabilities,
        commands: this.options.capabilities,
        permissions: {},
        auth: {
          token: this.options.token
        },
        locale: 'en-US',
        userAgent: `lisanode-rework/${this.options.clientVersion}`
      }
    };

    this._sendRaw(req);
    logger.info('Sent connect request');
  }

  _handleResponse(data) {
    // Connection response
    if (data.ok && data.payload?.type === 'connect.ok') {
      clearTimeout(this._connectTimeout);
      this._isConnected = true;
      this.reconnectAttempts = 0;
      this._availableMethods = data.payload.features?.methods || [];
      logger.info('✅ Node registered successfully', {
        methods: this._availableMethods.length,
        methodsList: this._availableMethods.slice(0, 10)
      });
      this.connectResolve?.(data.payload);
      this.connectResolve = null;
      this.connectReject = null;
      return;
    }

    if (!data.ok && data.error) {
      logger.error('❌ Connection rejected', {
        code: data.error.code,
        message: data.error.message,
        details: data.error.details
      });
      // Don't auto-reconnect on auth errors
      if (data.error.code === 'UNAUTHORIZED' || data.error.code === 'INVALID_TOKEN') {
        clearTimeout(this._connectTimeout);
        this.connectReject?.(new Error(`Auth failed: ${data.error.message}`));
        this._shouldReconnect = false;
        return;
      }
    }

    // Pending request response
    const pending = this.pendingRequests.get(data.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(data.id);
      if (data.ok) {
        pending.resolve(data);
      } else {
        pending.reject(new Error(data.error?.message || `Request failed: ${data.id}`));
      }
    }
  }

  _handleRequest(data) {
    logger.debug('Request received', { method: data.method, id: data.id });

    if (data.method === 'node.ping') {
      this._sendRaw({ type: 'res', id: data.id, ok: true, payload: { pong: Date.now() } });
    } else if (data.method === 'node.status') {
      this._sendRaw({
        type: 'res', id: data.id, ok: true,
        payload: {
          connected: this._isConnected,
          capabilities: this.options.capabilities,
          displayName: this.options.displayName
        }
      });
    } else if (data.method === 'node.info') {
      this._sendRaw({
        type: 'res', id: data.id, ok: true,
        payload: {
          displayName: this.options.displayName,
          platform: 'win32',
          version: this.options.clientVersion,
          capabilities: this.options.capabilities,
          methods: this._availableMethods
        }
      });
    }
  }

  _handleNodeInvoke(payload) {
    const { command, params, invoke_id } = payload;

    if (!invoke_id) {
      logger.warn('node.invoke missing invoke_id', { payload });
      return;
    }

    logger.debug('Command received', { command, params });

    const handler = this.commandHandlers.get(command);
    if (!handler) {
      this._sendNodeInvokeResponse(invoke_id, false, {
        error: 'UNKNOWN_COMMAND',
        message: `Command not found: ${command}`,
        available: this._availableMethods
      });
      return;
    }

    Promise.resolve(handler(params || {}))
      .then(result => {
        this._sendNodeInvokeResponse(invoke_id, true, result);
      })
      .catch(err => {
        logger.error(`Command ${command} failed`, { error: err.message });
        this._sendNodeInvokeResponse(invoke_id, false, {
          error: 'EXECUTION_ERROR',
          message: err.message
        });
      });
  }

  _sendNodeInvokeResponse(invoke_id, success, result) {
    this._sendRaw({
      type: 'event',
      event: 'node.invoke.response',
      payload: { invoke_id, success, result }
    });
  }

  _onError(err) {
    logger.error('WebSocket error', { error: err.message });
    this.connectReject?.(err);
    this.connectReject = null;
    this.connectResolve = null;
  }

  _onClose(event) {
    logger.warn('WebSocket closed', { code: event.code, reason: event.reason });
    this._isConnected = false;
    clearTimeout(this._connectTimeout);

    if (this._shouldReconnect && this.options.autoReconnect) {
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      logger.error('Max reconnect attempts reached, giving up');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.options.reconnectIntervalMs * Math.pow(2, this.reconnectAttempts - 1),
      this.options.maxReconnectDelayMs
    );

    logger.info(`Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (this._shouldReconnect) {
        this._doConnect().catch(err => {
          logger.error('Reconnect failed', { error: err.message });
        });
      }
    }, delay);
  }

  _sendRaw(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  _nextId() {
    return `req-${Date.now()}-${++this.requestId}`;
  }

  /** Send a request to gateway and wait for response */
  async sendRequest(method, params = {}) {
    if (!this._isConnected) {
      throw new Error('Not connected');
    }

    const id = this._nextId();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${id} timed out`));
      }, 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this._sendRaw({ type: 'req', id, method, params });
    });
  }

  /** Disconnect and stop auto-reconnect */
  disconnect() {
    logger.info('Disconnecting...');
    this._shouldReconnect = false;
    this._isConnected = false;
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    clearTimeout(this._connectTimeout);
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Disconnected'));
    }
    this.pendingRequests.clear();
  }
}

export default NodeProtocolClient;
