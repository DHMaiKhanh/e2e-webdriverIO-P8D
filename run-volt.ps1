# run-volt.ps1
# One command: boot the P8_Dual emulator at a fixed LARGE window (with working DNS)
# and open Volt POS straight to Home (uses the persisted session, no login).
#
#   powershell -ExecutionPolicy Bypass -File .\run-volt.ps1
#
# The window is auto-sized to fill the screen every launch. Tweak $Fill for a
# smaller/bigger window (0.92 = almost full height, 0.70 = smaller).

param(
  [double]$Scale = 0.40,   # legacy: written to emulator-user.ini as a fallback
  [double]$Fill  = 0.92    # window height as a fraction of the screen's usable height
)

$ErrorActionPreference = 'Stop'

$Avd     = 'P8_Dual'
$Serial  = 'emulator-5554'
$Emulator= 'C:\Android\Sdk\emulator\emulator.exe'
$Pkg     = 'com.fastboy.volt_pos'
$UserIni = Join-Path $env:USERPROFILE ".android\avd\$Avd.avd\emulator-user.ini"

# 1) Force a fixed, large window size on every launch (fixes the tiny/black window).
#    window.scale = -1 means "auto" -> the emulator picks a small default. Pin it instead.
if (Test-Path $UserIni) {
  $c = Get-Content $UserIni -Raw
  if ($c -match 'window\.scale') {
    $c = $c -replace 'window\.scale\s*=.*', ("window.scale = {0:F6}" -f $Scale)
  } else {
    $c = $c.TrimEnd() + "`nwindow.scale = $("{0:F6}" -f $Scale)`n"
  }
  Set-Content -Path $UserIni -Value $c -Encoding ascii
}

# 2) Boot the emulator only if it is not already running (with an explicit public DNS,
#    otherwise the P8_Dual AVD boots with dead DNS and the app cannot reach upstream).
$running = (& adb devices) -match $Serial
if (-not $running) {
  Write-Host "Booting $Avd ..."
  Start-Process $Emulator -ArgumentList @('-avd', $Avd, '-dns-server', '8.8.8.8,8.8.4.4', '-no-snapshot-load')
  & adb -s $Serial wait-for-device
  do {
    Start-Sleep -Seconds 2
    # getprop can print "device not found/offline" to stderr and nothing to stdout
    # while the emulator is still coming up. Out-String guarantees a string (never
    # $null), so .Trim() can't blow up and the loop just retries until boot_completed=1.
    $b = (& adb -s $Serial shell getprop sys.boot_completed 2>$null | Out-String).Trim()
  } while ($b -ne '1')
  Write-Host "Booted. Waiting for WiFi/DNS to associate ..."
  Start-Sleep -Seconds 15
} else {
  Write-Host "$Serial already running."
}

# 3) Launch Volt POS (persisted session -> straight to Home, no login).
& adb -s $Serial shell monkey -p $Pkg -c android.intent.category.LAUNCHER 1 | Out-Null
Write-Host "Volt POS launched on $Serial."

# 4) Resize + move the emulator's host window so it is ALWAYS large, every launch.
#    The emulator ignores window.scale/x/y from the ini on cold boot: it opens a small
#    window, often partly above the top edge. So we FORCE size+position via Win32 after
#    it appears. (Old bug: matched the title on "emulator-5554" but the real title is
#    "Android Emulator - P8_Dual:5554", so this step never ran and the window stayed tiny.)
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class EmuWin {
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool repaint);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@

# Target: fill the screen height; width from the phone aspect (~0.47 incl. the side toolbar).
$wa      = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$margin  = 20
$targetH = [int][Math]::Min($wa.Height * $Fill, $wa.Height - $margin)
$targetW = [int]($targetH * 0.47)
$x       = $wa.X + $margin
$y       = $wa.Y + $margin

# Match the real emulator window: title contains the AVD name or the ":5554" port.
$find = {
  Get-Process | Where-Object {
    $_.MainWindowHandle -ne 0 -and
    (($_.MainWindowTitle -match [regex]::Escape($Avd)) -or ($_.MainWindowTitle -match '5554'))
  } | Select-Object -First 1
}

$p = $null
for ($i = 0; $i -lt 30 -and -not $p; $i++) {
  $p = & $find
  if (-not $p) { Start-Sleep -Seconds 1 }
}
if ($p) {
  # Re-apply a few times to beat the emulator's own resizing during boot.
  for ($j = 0; $j -lt 5; $j++) {
    [void][EmuWin]::MoveWindow($p.MainWindowHandle, $x, $y, $targetW, $targetH, $true)
    Start-Sleep -Milliseconds 600
  }
  [void][EmuWin]::SetForegroundWindow($p.MainWindowHandle)
  Write-Host ("Emulator window sized {0}x{1} at ({2},{3})." -f $targetW, $targetH, $x, $y)
} else {
  Write-Host "WARN: emulator window not found to resize."
}
