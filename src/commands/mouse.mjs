/** Mouse & Keyboard Commands */
import { runPowerShell, psEscape, parsePsJson } from '../ps-engine.mjs';

export const commands = {};

/* MOUSE */
commands['mouse.move'] = async (params) => {
  const { x, y } = params || {};
  if (x === undefined || y === undefined) return { success: false, error: 'x, y required' };
  await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.Cursor]::Position=[System.Drawing.Point]::new(${x},${y})`);
  return { success: true, x, y };
};

commands['mouse.position'] = async () => {
  const r = await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms;$p=[System.Windows.Forms.Cursor]::Position;@{x=$p.X;y=$p.Y}|ConvertTo-Json-Compress`);
  return { position: parsePsJson(r.stdout) || { x: 0, y: 0 } };
};

commands['mouse.click'] = async (params) => {
  const { x, y, button = 'left' } = params || {};
  if (x !== undefined && y !== undefined) {
    await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.Cursor]::Position=[System.Drawing.Point]::new(${x},${y});Start-Sleep-Milliseconds 50`);
  }
  const btn = button === 'right' ? 'RIGHT' : 'LEFT';
  await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.SendKeys]::SendWait('{'+'${btn}'+'CLICK}')`);
  return { success: true };
};

commands['mouse.rightclick'] = async (params) => {
  const { x, y } = params || {};
  if (x !== undefined && y !== undefined) {
    await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.Cursor]::Position=[System.Drawing.Point]::new(${x},${y});Start-Sleep-Milliseconds 50`);
  }
  await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.SendKeys]::SendWait('{RIGHTCLICK}')`);
  return { success: true };
};

commands['mouse.doubleclick'] = async (params) => {
  const { x, y } = params || {};
  if (x !== undefined && y !== undefined) {
    await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.Cursor]::Position=[System.Drawing.Point]::new(${x},${y});Start-Sleep-Milliseconds 50`);
  }
  await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.SendKeys]::SendWait('{LEFTCLICK}{LEFTCLICK}')`);
  return { success: true };
};

commands['mouse.scroll'] = async (params) => {
  const { amount = 3 } = params || {};
  const direction = amount >= 0 ? 'UP' : 'DOWN';
  const times = Math.abs(amount);
  await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms;for($i=0;$i-lt ${times};$i++){[System.Windows.Forms.SendKeys]::SendWait('{${direction} 3}')}`);
  return { success: true, amount };
};

/* KEYBOARD */
commands['keyboard.type'] = async (params) => {
  const { text } = params || {};
  if (!text) return { success: false, error: 'text required' };
  await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.SendKeys]::SendWait('${psEscape(text)}')`);
  return { success: true };
};

commands['keyboard.hotkey'] = async (params) => {
  const { keys } = params || {};
  if (!keys) return { success: false, error: 'keys required' };
  const safeKeys = keys.replace(/[^a-zA-Z0-9 \-+^%~()[\]{}]/g, '');
  await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.SendKeys]::SendWait('${safeKeys}')`);
  return { success: true };
};

commands['keyboard.press'] = async (params) => {
  const { key } = params || {};
  if (!key) return { success: false, error: 'key required' };
  await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.SendKeys]::SendWait('{${psEscape(key)}}')`);
  return { success: true };
};
