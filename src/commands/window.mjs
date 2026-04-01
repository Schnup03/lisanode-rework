/** Window Management Commands */
import { runPowerShell, psEscape, parsePsJson } from '../ps-engine.mjs';

export const commands = {};

commands['window.list'] = async () => {
  const r = await runPowerShell(`Get-Process|Where-Object{$_.MainWindowTitle}|Select-Object Id,ProcessName,MainWindowTitle|ConvertTo-Json-Compress`);
  return { windows: parsePsJson(r.stdout) || [] };
};

commands['window.listall'] = async () => {
  const r = await runPowerShell(`Get-Process|Where-Object{$_.MainWindowTitle}|Select-Object Id,ProcessName,MainWindowTitle,@{N='MemoryMB';E={[math]::Round($_.WorkingSet64/1MB,1)}},@{N='CPU';E={[math]::Round($_.CPU,2)}}|ConvertTo-Json -Depth 3 -Compress`);
  return { windows: parsePsJson(r.stdout) || [] };
};

commands['window.find'] = async (params) => {
  const title = params?.title;
  if (!title) return { windows: [], error: 'title required' };
  const r = await runPowerShell(`Get-Process|Where-Object{$_.MainWindowTitle-like'*${psEscape(title)}*'}|Select-Object Id,ProcessName,MainWindowTitle|ConvertTo-Json-Compress`);
  return { windows: parsePsJson(r.stdout) || [] };
};

commands['window.active'] = async () => {
  const r = await runPowerShell(`Add-Type @"
using System;using System.Runtime.InteropServices;using System.Text;
public class WF{
  [DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]public static extern int GetWindowText(IntPtr h,StringBuilder t,int c);
}
"@;$h=[WF]::GetForegroundWindow();$s=[StringBuilder]::new(256);[WF]::GetWindowText($h,$s,256)|Out-Null;$s.ToString()`);
  return { title: r.stdout.trim() };
};

commands['window.focus'] = async (params) => {
  const title = params?.title;
  if (!title) return { success: false, error: 'title required' };
  await runPowerShell(`$pr=Get-Process|Where-Object{$_.MainWindowTitle-like'*${psEscape(title)}*'}|Select-Object-First 1
if($pr){$h=$pr.MainWindowHandle;if($h-ne[IntPtr]::Zero){
Add-Type @"
using System;using System.Runtime.InteropServices;
public class WF{
  [DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")]public static extern bool ShowWindow(IntPtr h,int c);
  public const int SW_RESTORE=9;
}
"@;[WF]::ShowWindow($h,[WF]::SW_RESTORE)|Out-Null;[WF]::SetForegroundWindow($h)|Out-Null}}`);
  return { success: true };
};

commands['window.minimize'] = async (params) => {
  const title = params?.title;
  if (!title) return { success: false, error: 'title required' };
  await runPowerShell(`$pr=Get-Process|Where-Object{$_.MainWindowTitle-like'*${psEscape(title)}*'}|Select-Object-First 1
if($pr){$h=$pr.MainWindowHandle;if($h-ne[IntPtr]::Zero){
Add-Type @"
using System;using System.Runtime.InteropServices;
public class WF{ [DllImport("user32.dll")]public static extern bool ShowWindow(IntPtr h,int c); public const int SW_MINIMIZE=6; }
"@;[WF]::ShowWindow($h,[WF]::SW_MINIMIZE)|Out-Null}}`);
  return { success: true };
};

commands['window.maximize'] = async (params) => {
  const title = params?.title;
  if (!title) return { success: false, error: 'title required' };
  await runPowerShell(`$pr=Get-Process|Where-Object{$_.MainWindowTitle-like'*${psEscape(title)}*'}|Select-Object-First 1
if($pr){$h=$pr.MainWindowHandle;if($h-ne[IntPtr]::Zero){
Add-Type @"
using System;using System.Runtime.InteropServices;
public class WF{ [DllImport("user32.dll")]public static extern bool ShowWindow(IntPtr h,int c); public const int SW_MAXIMIZE=3; }
"@;[WF]::ShowWindow($h,[WF]::SW_MAXIMIZE)|Out-Null}}`);
  return { success: true };
};

commands['window.restore'] = async (params) => {
  const title = params?.title;
  if (!title) return { success: false, error: 'title required' };
  await runPowerShell(`$pr=Get-Process|Where-Object{$_.MainWindowTitle-like'*${psEscape(title)}*'}|Select-Object-First 1
if($pr){$h=$pr.MainWindowHandle;if($h-ne[IntPtr]::Zero){
Add-Type @"
using System;using System.Runtime.InteropServices;
public class WF{ [DllImport("user32.dll")]public static extern bool ShowWindow(IntPtr h,int c); public const int SW_RESTORE=9; }
"@;[WF]::ShowWindow($h,[WF]::SW_RESTORE)|Out-Null}}`);
  return { success: true };
};

commands['window.close'] = async (params) => {
  const title = params?.title;
  if (!title) return { success: false, error: 'title required' };
  await runPowerShell(`Get-Process|Where-Object{$_.MainWindowTitle-like'*${psEscape(title)}*'}|Select-Object-First 1|Stop-Process-Force-EA SilentlyContinue`);
  return { success: true };
};

commands['window.move'] = async (params) => {
  const { title, x, y } = params || {};
  if (!title || x === undefined || y === undefined) return { success: false, error: 'title, x, y required' };
  await runPowerShell(`$pr=Get-Process|Where-Object{$_.MainWindowTitle-like'*${psEscape(title)}*'}|Select-Object-First 1
if($pr){$h=$pr.MainWindowHandle;if($h-ne[IntPtr]::Zero){
Add-Type @"
using System;using System.Runtime.InteropServices;
public class WF{ [DllImport("user32.dll")]public static extern bool MoveWindow(IntPtr h,int X,int Y,int W,int H,bool r); }
"@;[WF]::MoveWindow($h,${x},${y},800,600,$true)|Out-Null}}`);
  return { success: true };
};

commands['window.resize'] = async (params) => {
  const { title, width, height } = params || {};
  if (!title || !width || !height) return { success: false, error: 'title, width, height required' };
  await runPowerShell(`$pr=Get-Process|Where-Object{$_.MainWindowTitle-like'*${psEscape(title)}*'}|Select-Object-First 1
if($pr){$h=$pr.MainWindowHandle;if($h-ne[IntPtr]::Zero){
Add-Type @"
using System;using System.Runtime.InteropServices;
public class WF{ [DllImport("user32.dll")]public static extern bool MoveWindow(IntPtr h,int X,int Y,int W,int H,bool r); }
"@;[WF]::MoveWindow($h,0,0,${width},${height},$true)|Out-Null}}`);
  return { success: true };
};
