/** Network, App Management, and Utility Commands */
import { runPowerShell, psEscape, parsePsJson } from '../ps-engine.mjs';

export const commands = {};

/* NETWORK */
commands['network.info'] = async () => {
  const r = await runPowerShell(`@{
  ipconfig=(ipconfig /all 2>&1|Out-String).Trim()
  adapters=Get-NetAdapter|Select-Object Name,Status,MacAddress,LinkSpeed|ConvertTo-Json -Compress
  dns=Get-DnsClientServerAddress -AddressFamily IPv4|Select-Object InterfaceAlias,ServerAddresses|ConvertTo-Json -Compress
}|ConvertTo-Json -Depth 4 -Compress`);
  return { network: parsePsJson(r.stdout) };
};

commands['network.ping'] = async (params) => {
  const { host = '8.8.8.8', count = 4 } = params || {};
  const r = await runPowerShell(`Test-Connection -ComputerName '${psEscape(host)}' -Count ${count}|Select-Object Address,ResponseTime,StatusCode|ConvertTo-Json-Compress`);
  return { ping: parsePsJson(r.stdout) || [] };
};

commands['network.dns'] = async (params) => {
  const { domain } = params || {};
  if (!domain) return { success: false, error: 'domain required' };
  const r = await runPowerShell(`Resolve-DnsName '${psEscape(domain)}' -EA SilentlyContinue|Select-Object Name,Type,IPAddress|ConvertTo-Json -Compress`);
  return { dns: parsePsJson(r.stdout) || [] };
};

commands['network.flushdns'] = async () => {
  const r = await runPowerShell(`Clear-DnsClientCache;"flushed"`);
  return { result: r.stdout || 'done' };
};

commands['network.connections'] = async () => {
  const r = await runPowerShell(`Get-NetTCPConnection -State Established|Select-Object LocalAddress,LocalPort,RemoteAddress,RemotePort,OwningProcess,@{N='ProcessName';E={(Get-Process -Id $_.OwningProcess -EA SilentlyContinue).ProcessName}}|ConvertTo-Json-Compress`);
  return { connections: parsePsJson(r.stdout) || [] };
};

commands['network.wifi'] = async () => {
  const r = await runPowerShell(`netsh wlan show interfaces|Select-String-Pattern "SSID|State|Signal|Channel" 2>&1`);
  return { wifi: r.stdout || r.stderr };
};

/* APP MANAGEMENT (winget) */
commands['app.list'] = async () => {
  const r = await runPowerShell(`try{winget list --accept-source-agreements 2>&1|Out-String}catch{"[]"}`);
  return { apps: r.stdout || '[]' };
};

commands['app.install'] = async (params) => {
  const pkg = params?.package;
  if (!pkg) return { success: false, error: 'package required' };
  const r = await runPowerShell(`winget install --accept-package-agreements --accept-source-agreements '${psEscape(pkg)}' 2>&1|Out-String`, { timeout: 300000 });
  return { success: true, package: pkg, output: r.stdout || r.stderr };
};

commands['app.uninstall'] = async (params) => {
  const pkg = params?.package;
  if (!pkg) return { success: false, error: 'package required' };
  const r = await runPowerShell(`winget uninstall --accept-source-agreements '${psEscape(pkg)}' 2>&1|Out-String`, { timeout: 120000 });
  return { success: true, package: pkg, output: r.stdout || r.stderr };
};

commands['app.search'] = async (params) => {
  const pkg = params?.package;
  if (!pkg) return { success: false, error: 'package required' };
  const r = await runPowerShell(`winget search '${psEscape(pkg)}' --accept-source-agreements 2>&1|Out-String`, { timeout: 60000 });
  return { results: r.stdout || r.stderr };
};

/* WINDOWS UPDATE */
commands['windowsupdate.status'] = async () => {
  const r = await runPowerShell(`$s=New-Object -ComObject Microsoft.Update.Session -EA SilentlyContinue;if(-not$s){"unavailable"}else{$sh=$s.CreateUpdateSearcher();$p=$sh.Search("IsInstalled=0").Updates.Count;$h=$sh.GetTotalHistoryCount();@{pending=$p;history=$h}|ConvertTo-Json -Compress}}`);
  return { status: parsePsJson(r.stdout) };
};

commands['windowsupdate.list'] = async () => {
  const r = await runPowerShell(`$s=New-Object -ComObject Microsoft.Update.Session -EA SilentlyContinue;if(-not$s){"[]"}else{$u=$s.CreateUpdateSearcher().Search("IsInstalled=0").Updates;$l=@();foreach($x in $u){$l+=@{title=$x.Title;KB=$x.KBArticleIDs}};$l|ConvertTo-Json -Compress}}`);
  return { updates: parsePsJson(r.stdout) || [] };
};

commands['windowsupdate.install'] = async () => {
  const r = await runPowerShell(`$s=New-Object -ComObject Microsoft.Update.Session;$u=$s.CreateUpdateSearcher().Search("IsInstalled=0").Updates;if($u.Count -eq 0){"no_updates"}else{$d=$s.CreateUpdateDownloader();$d.Updates=$u;$d.Download()|Out-Null;$i=$s.CreateUpdateInstaller();$i.Updates=$u;$i.Install()|Out-Null;"installed"}}`, { timeout: 600000 });
  return { result: r.stdout || 'done' };
};

/* WSL */
commands['wsl.list'] = async () => {
  const r = await runPowerShell(`wsl --list --verbose 2>&1|Out-String`);
  return { distros: r.stdout || r.stderr };
};

commands['wsl.run'] = async (params) => {
  const { command, distro } = params || {};
  if (!command) return { success: false, error: 'command required' };
  const r = distro ? await runPowerShell(`wsl -d '${psEscape(distro)}' -- ${command} 2>&1|Out-String`) : await runPowerShell(`wsl -- ${command} 2>&1|Out-String`);
  return { stdout: r.stdout || r.stderr, exitCode: r.exitCode };
};

/* SERVICES */
commands['service.list'] = async (params) => {
  const { status = 'Running' } = params || {};
  const r = await runPowerShell(`Get-Service|Where-Object{$_.Status -eq '${status}'}|Select-Object Name,DisplayName,Status|Sort-Object DisplayName|ConvertTo-Json -Compress`);
  return { services: parsePsJson(r.stdout) || [] };
};

commands['service.status'] = async (params) => {
  const name = params?.name;
  if (!name) return { success: false, error: 'name required' };
  const r = await runPowerShell(`Get-Service -Name '${psEscape(name)}' -EA SilentlyContinue|Select-Object Name,Status,StartType|ConvertTo-Json-Compress`);
  return { service: parsePsJson(r.stdout) };
};

commands['service.start'] = async (params) => {
  const name = params?.name;
  if (!name) return { success: false, error: 'name required' };
  await runPowerShell(`Start-Service-Name '${psEscape(name)}'-EA SilentlyContinue`);
  return { success: true };
};

commands['service.stop'] = async (params) => {
  const name = params?.name;
  if (!name) return { success: false, error: 'name required' };
  await runPowerShell(`Stop-Service-Name '${psEscape(name)}'-Force-EA SilentlyContinue`);
  return { success: true };
};

commands['service.restart'] = async (params) => {
  const name = params?.name;
  if (!name) return { success: false, error: 'name required' };
  await runPowerShell(`Restart-Service-Name '${psEscape(name)}'-Force-EA SilentlyContinue`);
  return { success: true };
};

/* DEVICES */
commands['device.list'] = async () => {
  const r = await runPowerShell(`Get-PnpDevice -Class * -Status OK -EA SilentlyContinue|Select-Object FriendlyName,InstanceId,Status,Class|ConvertTo-Json-Compress`);
  return { devices: parsePsJson(r.stdout) || [] };
};

commands['device.enable'] = async (params) => {
  const { instanceId } = params || {};
  if (!instanceId) return { success: false, error: 'instanceId required' };
  await runPowerShell(`Enable-PnpDevice-InstanceId '${psEscape(instanceId)}'-Confirm:$false-EA SilentlyContinue`);
  return { success: true };
};

commands['device.disable'] = async (params) => {
  const { instanceId } = params || {};
  if (!instanceId) return { success: false, error: 'instanceId required' };
  await runPowerShell(`Disable-PnpDevice-InstanceId '${psEscape(instanceId)}'-Confirm:$false-EA SilentlyContinue`);
  return { success: true };
};

/* POWER MANAGEMENT */
commands['power.lock'] = async () => {
  await runPowerShell(`rundll32.exe user32.dll,LockWorkStation`);
  return { success: true };
};

commands['power.sleep'] = async () => {
  await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.Application]::SetSuspendState('Sleep',$false,$false)`);
  return { success: true };
};

commands['power.hibernate'] = async () => {
  await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.Application]::SetSuspendState('Hibernate',$false,$false)`);
  return { success: true };
};

commands['power.shutdown'] = async () => {
  await runPowerShell(`Stop-Computer-Force-EA SilentlyContinue`);
  return { success: true };
};

commands['power.restart'] = async () => {
  await runPowerShell(`Restart-Computer-Force-EA SilentlyContinue`);
  return { success: true };
};

/* REGISTRY */
commands['registry.read'] = async (params) => {
  const { path: regPath, name } = params || {};
  if (!regPath || !name) return { success: false, error: 'path and name required' };
  const r = await runPowerShell(`Get-ItemProperty-Path '${psEscape(regPath)}'-Name '${psEscape(name)}'-EA SilentlyContinue|Select-Object -ExpandProperty '${psEscape(name)}'`);
  return { value: r.stdout.trim() || null };
};

commands['registry.write'] = async (params) => {
  const { path: regPath, name, value, type = 'String' } = params || {};
  if (!regPath || !name || value === undefined) return { success: false, error: 'path, name, value required' };
  await runPowerShell(`Set-ItemProperty-Path '${psEscape(regPath)}'-Name '${psEscape(name)}'-Value '${psEscape(value)}'-Type ${type}-Force-EA SilentlyContinue`);
  return { success: true };
};

/* NOTIFICATIONS */
commands['notify'] = async (params) => {
  const { title = 'LisaNode', message } = params || {};
  if (!message) return { success: false, error: 'message required' };
  await runPowerShell(`[Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime]|Out-Null
$t=[Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$txt=$t.GetElementsByTagName('text')
$txt.Item(0).AppendChild($t.CreateTextNode('${psEscape(title)}'))|Out-Null
$txt.Item(1).AppendChild($t.CreateTextNode('${psEscape(message)}'))|Out-Null
$n=[Windows.UI.Notifications.ToastNotification]::new($t)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('LisaNode').Show($n)`, { timeout: 10000 });
  return { success: true };
};

/* PING */
commands['ping'] = async () => {
  return { pong: Date.now(), node: 'LisaNode-Windows' };
};

/* CAPABILITIES */
commands['capabilities'] = async () => {
  return { message: 'See command registry for all available commands' };
};
