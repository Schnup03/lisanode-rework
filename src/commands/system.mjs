/** System Info & Process Management Commands */
import { runPowerShell, psEscape, parsePsJson } from '../ps-engine.mjs';

export const commands = {};

/* PROCESS MANAGEMENT */
commands['process.list'] = async (params) => {
  const { limit = 50, name } = params || {};
  let cmd = `Get-Process|Select-Object -First ${limit} Id,ProcessName,@{N='CPU';E={[math]::Round($_.CPU,2)}},@{N='MemoryMB';E={[math]::Round($_.WorkingSet64/1MB,1)}}|ConvertTo-Json-Compress`;
  if (name) cmd = `Get-Process -Name '${psEscape(name)}*' -EA SilentlyContinue|Select-Object Id,ProcessName,@{N='CPU';E={[math]::Round($_.CPU,2)}},@{N='MemoryMB';E={[math]::Round($_.WorkingSet64/1MB,1)}}|ConvertTo-Json-Compress`;
  const r = await runPowerShell(cmd);
  return { processes: parsePsJson(r.stdout) || [] };
};

commands['process.kill'] = async (params) => {
  const { pid, name } = params || {};
  if (pid) { await runPowerShell(`Stop-Process -Id ${pid} -Force -EA SilentlyContinue`); return { success: true, pid }; }
  if (name) { await runPowerShell(`Stop-Process -Name '${psEscape(name)}' -Force -EA SilentlyContinue`); return { success: true, name }; }
  return { success: false, error: 'pid or name required' };
};

commands['process.info'] = async (params) => {
  const pid = params?.pid;
  if (!pid) return { success: false, error: 'pid required' };
  const r = await runPowerShell(`Get-Process -Id ${pid} -EA SilentlyContinue|Select-Object Id,ProcessName,Path,Company,@{N='CPU';E={[math]::Round($_.CPU,2)}},@{N='MemoryMB';E={[math]::Round($_.WorkingSet64/1MB,1)}},@{N='Threads';E={$_.Threads.Count}},StartTime|ConvertTo-Json -Depth 2 -Compress`);
  return { info: parsePsJson(r.stdout) };
};

commands['process.start'] = async (params) => {
  const { name, path: exePath, args } = params || {};
  if (!name && !exePath) return { success: false, error: 'name or path required' };
  let cmd;
  if (exePath) {
    cmd = args ? `Start-Process '${psEscape(exePath)}' -ArgumentList '${psEscape(args)}'` : `Start-Process '${psEscape(exePath)}'`;
  } else {
    cmd = args ? `Start-Process '${psEscape(name)}' -ArgumentList '${psEscape(args)}'` : `Start-Process '${psEscape(name)}'`;
  }
  await runPowerShell(cmd);
  return { success: true };
};

/* SYSTEM INFO */
commands['system.info'] = async () => {
  const r = await runPowerShell(`Get-ComputerInfo|Select-Object CsName,WindowsProductName,WindowsVersion,OsArchitecture,CsProcessors,CsTotalPhysicalMemory|ConvertTo-Json -Depth 3 -Compress`);
  return { info: parsePsJson(r.stdout) };
};

commands['system.cpu'] = async () => {
  const r = await runPowerShell(`Get-CimInstance Win32_Processor|Select-Object Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed,LoadPercentage|ConvertTo-Json-Compress`);
  return { cpu: parsePsJson(r.stdout) };
};

commands['system.memory'] = async () => {
  const r = await runPowerShell(`$os=Get-CimInstance Win32_OperatingSystem;@{TotalGB=[math]::Round($os.TotalVisibleMemorySize/1MB,1);FreeGB=[math]::Round($os.FreePhysicalMemory/1MB,1);UsedGB=[math]::Round(($os.TotalVisibleMemorySize-$os.FreePhysicalMemory)/1MB,1)}|ConvertTo-Json-Compress`);
  return { memory: parsePsJson(r.stdout) };
};

commands['system.disk'] = async () => {
  const r = await runPowerShell(`Get-Volume|Where-Object{$_.DriveLetter}|Select-Object DriveLetter,@{N='SizeGB';E={[math]::Round($_.Size/1GB,1)}},@{N='FreeGB';E={[math]::Round($_.SizeRemaining/1GB,1)}},FileSystemLabel|ConvertTo-Json-Compress`);
  return { disks: parsePsJson(r.stdout) || [] };
};

commands['system.gpu'] = async () => {
  const r = await runPowerShell(`Get-CimInstance Win32_VideoController|Select-Object Name,DriverVersion,AdapterRAM,CurrentHorizontalResolution,CurrentVerticalResolution|ConvertTo-Json-Compress`);
  return { gpu: parsePsJson(r.stdout) };
};

commands['system.uptime'] = async () => {
  const r = await runPowerShell(`$os=Get-CimInstance Win32_OperatingSystem;$u=(Get-Date)-$os.LastBootUpTime;@{Days=$u.Days;Hours=$u.Hours;Minutes=$u.Minutes;Started=$os.LastBootUpTime}|ConvertTo-Json-Compress`);
  return { uptime: parsePsJson(r.stdout) };
};

commands['system.bios'] = async () => {
  const r = await runPowerShell(`Get-CimInstance Win32_BIOS|Select-Object Manufacturer,SerialNumber,SMBIOSBIOSVersion|ConvertTo-Json-Compress`);
  return { bios: parsePsJson(r.stdout) };
};

commands['system.display'] = async () => {
  const r = await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms;@{Primary=@{Width=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width;Height=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height};Count=[System.Windows.Forms.Screen]::AllScreens.Count}|ConvertTo-Json-Compress`);
  return { display: parsePsJson(r.stdout) };
};

/* CLIPBOARD */
commands['clipboard.get'] = async () => {
  const r = await runPowerShell(`Get-Clipboard -Format Text -EA SilentlyContinue`);
  return { text: r.stdout || '' };
};

commands['clipboard.set'] = async (params) => {
  const { text } = params || {};
  if (text === undefined) return { success: false, error: 'text required' };
  await runPowerShell(`Set-Clipboard -Value '${psEscape(text)}'`);
  return { success: true };
};

/* POWERSHELL EXECUTION */
commands['powershell.exec'] = async (params) => {
  const { command, timeout = 30000 } = params || {};
  if (!command) return { success: false, error: 'command required' };
  const r = await runPowerShell(command, { timeout });
  return { success: r.success, stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode };
};
