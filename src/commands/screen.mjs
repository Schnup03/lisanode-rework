/** Screen Capture Commands */
import { runPowerShell, psEscape, parsePsJson } from '../ps-engine.mjs';
import { readFileSync, unlinkSync, existsSync } from 'fs';

export const commands = {};

commands['screen.capture'] = async (params) => {
  const { monitor = 0 } = params || {};
  const tmp = `C:\\Windows\\Temp\\lisanode-sc-${Date.now()}.png`;
  // Escape backslashes for PowerShell: replace \ with \\
  const tmpEscaped = tmp.replace(/\\/g, '\\\\');
  const r = await runPowerShell(
    'Add-Type -AssemblyName System.Windows.Forms;Add-Type -AssemblyName System.Drawing;' +
    '$s=[System.Windows.Forms.Screen]::AllScreens[' + monitor + '];' +
    'if(-not$s){$s=[System.Windows.Forms.Screen]::AllScreens[0]};' +
    '$b=New-Object System.Drawing.Bitmap($s.Bounds.Width,$s.Bounds.Height);' +
    '$g=[System.Drawing.Graphics]::FromImage($b);' +
    '$g.CopyFromScreen($s.Bounds.Location,[System.Drawing.Point]::Empty,$s.Bounds.Size);' +
    '$b.Save(\'' + tmpEscaped + '\',[System.Drawing.Imaging.ImageFormat]::Png);' +
    '$g.Dispose();$b.Dispose();echo"OK"'
  );
  if (existsSync(tmp)) {
    const d = readFileSync(tmp);
    unlinkSync(tmp);
    return { success: true, image_base64: d.toString('base64'), format: 'png' };
  }
  return { success: false, error: 'Screenshot failed', debug: r.stdout + r.stderr };
};

commands['screen.window'] = async (params) => {
  const title = params?.title;
  if (!title) return { success: false, error: 'title required' };
  const tmp = `C:\\Windows\\Temp\\lisanode-win-${Date.now()}.png`;
  const tmpEscaped = tmp.replace(/\\/g, '\\\\');
  const escapedTitle = psEscape(title);
  const r = await runPowerShell(
    'Add-Type -AssemblyName System.Windows.Forms;Add-Type -AssemblyName System.Drawing;' +
    "$pr=Get-Process|Where-Object{$_.MainWindowTitle-like'*" + escapedTitle + "*'}|Select-Object-First 1;" +
    'if(-not$pr){exit 1};$hwnd=$pr.MainWindowHandle;if($hwnd-eq[IntPtr]::Zero){exit 1};' +
    'Add-Type @"' +
    'using System;using System.Runtime.InteropServices;' +
    'public class R{ [DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h, out RECT r); ' +
    '[StructLayout(LayoutKind.Sequential)]public struct RECT{public int L,T,R,B;} }' +
    '"@;$rect=[R+RECT]::new();[R]::GetWindowRect($hwnd,[ref]$rect)|Out-Null;' +
    '$w=$rect.R-$rect.L;$hh=$rect.B-$rect.T;if($w-le0-or$hh-le0){exit 1};' +
    '$b=New-Object System.Drawing.Bitmap($w,$hh);$g=[System.Drawing.Graphics]::FromImage($b);' +
    '$g.CopyFromScreen($rect.L,$rect.T,0,0,[System.Drawing.Size]::new($w,$hh));' +
    '$b.Save(\'' + tmpEscaped + '\',[System.Drawing.Imaging.ImageFormat]::Png);' +
    '$g.Dispose();$b.Dispose();echo"OK:$w`:$hh"'
  );
  if (existsSync(tmp)) {
    const d = readFileSync(tmp);
    unlinkSync(tmp);
    const m = r.stdout.match(/OK:(\d+):(\d+)/);
    return { success: true, image_base64: d.toString('base64'), format: 'png', width: m ? m[1] : '?', height: m ? m[2] : '?' };
  }
  return { success: false, error: 'Window capture failed', debug: r.stdout + r.stderr };
};

commands['screen.monitors'] = async () => {
  const r = await runPowerShell(
    'Add-Type -AssemblyName System.Windows.Forms;' +
    '[System.Windows.Forms.Screen]::AllScreens|%{@{$_.DeviceName=@{' +
    'Primary=$_.Primary;' +
    'Bounds=@{X=$_.Bounds.X;Y=$_.Bounds.Y;W=$_.Bounds.Width;H=$_.Bounds.Height};' +
    'WorkingArea=@{X=$_.WorkingArea.X;Y=$_.WorkingArea.Y;W=$_.WorkingArea.Width;H=$_.WorkingArea.Height}' +
    '}}}|ConvertTo-Json-Depth 4'
  );
  return { monitors: parsePsJson(r.stdout) || [] };
};
