/**
 * PowerShell Engine - Safe Windows command execution
 */
import { spawn } from 'child_process';
import logger from './utils/logger.mjs';

/**
 * Escape a string for use inside PowerShell single-quoted strings
 * Single quotes are doubled ('') per PowerShell rules
 */
export function psEscape(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/'/g, "''");
}

/**
 * Run a PowerShell command and return structured result
 */
export function runPowerShell(command, options = {}) {
  return new Promise((resolve) => {
    const args = [
      '-NoProfile',
      '-NonInteractive',
      '-OutputFormat',
      'Text'
    ];

    // Add execution policy bypass only if needed
    if (options.bypassExecutionPolicy) {
      args.push('-ExecutionPolicy', 'Bypass');
    }

    // Command vs script file
    if (options.scriptFile) {
      args.push('-File', command);
    } else {
      args.push('-Command', command);
    }

    const proc = spawn('powershell.exe', args, {
      windowsHide: true,
      shell: false,
      timeout: options.timeout || 30000,
      ...options.spawnOptions
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    // Timeout
    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
      logger.warn('PowerShell timed out', { command: command.slice(0, 100) });
    }, options.timeout || 30000);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (killed) {
        resolve({
          success: false,
          stdout: stdout.trim(),
          stderr: 'Command timed out',
          exitCode: -1,
          timedOut: true
        });
      } else {
        resolve({
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      logger.error('PowerShell spawn error', { error: err.message });
      resolve({
        success: false,
        stdout: '',
        stderr: err.message,
        exitCode: -1
      });
    });
  });
}

/**
 * Parse JSON output from PowerShell (handles common edge cases)
 */
export function parsePsJson(stdout) {
  if (!stdout || !stdout.trim()) return null;

  // Try direct parse first
  try {
    return JSON.parse(stdout.trim());
  } catch { /* fall through */ }

  // Try with UTF-8 BOM removed
  try {
    const cleaned = stdout.replace(/^\uFEFF/, '').trim();
    return JSON.parse(cleaned);
  } catch { /* fall through */ }

  // Try extracting first JSON array/object from mixed output
  const match = stdout.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch { /* fall through */ }
  }

  return null;
}

/**
 * Run PowerShell and parse JSON output automatically
 */
export async function runPsJson(command, options = {}) {
  const result = await runPowerShell(command, options);
  if (!result.success && !options.allowNull) {
    logger.warn('PowerShell command failed', {
      command: command.slice(0, 100),
      stderr: result.stderr
    });
  }
  const parsed = parsePsJson(result.stdout);
  return { ...result, parsed };
}

/**
 * Helper: Build a safe PowerShell one-liner for simple commands
 */
export function psOneLiner(script) {
  return script;
}

/**
 * Run a file copy via PowerShell
 */
export async function psCopyFile(source, dest) {
  return runPowerShell(
    `Copy-Item -Path '${psEscape(source)}' -Destination '${psEscape(dest)}' -Force`
  );
}

/**
 * Run a registry read
 */
export async function psReadRegistry(keyPath, valueName) {
  const result = await runPowerShell(
    `Get-ItemProperty -Path '${psEscape(keyPath)}' -Name '${psEscape(valueName)}' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty '${psEscape(valueName)}'`
  );
  return result.success ? result.stdout.trim() : null;
}

/**
 * Run a registry write
 */
export async function psWriteRegistry(keyPath, valueName, value, valueType = 'String') {
  return runPowerShell(
    `Set-ItemProperty -Path '${psEscape(keyPath)}' -Name '${psEscape(valueName)}' -Value '${psEscape(value)}' -Type ${valueType} -Force`
  );
}

/**
 * Check if a process is running by name
 */
export async function psIsProcessRunning(name) {
  const result = await runPowerShell(
    `$p = Get-Process -Name '${psEscape(name)}' -ErrorAction SilentlyContinue; $p -ne $null`
  );
  return result.stdout.trim().toLowerCase() === 'true';
}

export default {
  runPowerShell,
  runPsJson,
  parsePsJson,
  psEscape,
  psOneLiner,
  psCopyFile,
  psReadRegistry,
  psWriteRegistry,
  psIsProcessRunning
};
