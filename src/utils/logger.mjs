/**
 * Logger - Simple structured logging (no external dependencies)
 */
import { readFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Log levels: debug=0, info=1, warn=2, error=3
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

// Log file path
const logDir = join(__dirname, '..', 'logs');
const logFile = process.env.LOG_FILE || join(logDir, 'lisanode.log');

// Ensure log directory exists
try {
  mkdirSync(logDir, { recursive: true });
} catch { /* ignore */ }

function formatTime() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function write(level, message, meta) {
  if (LOG_LEVELS[level] < currentLevel) return;

  const metaStr = meta && Object.keys(meta).length > 0
    ? ' ' + JSON.stringify(meta)
    : '';

  const line = `[${formatTime()}] [${level.toUpperCase()}] ${message}${metaStr}`;

  // Console output
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }

  // File output
  try {
    appendFileSync(logFile, line + '\n');
  } catch { /* ignore */ }
}

export default {
  debug: (msg, meta) => write('debug', msg, meta),
  info: (msg, meta) => write('info', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta)
};
