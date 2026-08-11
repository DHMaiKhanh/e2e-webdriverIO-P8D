# update-volt.ps1
# ONE command: build the LATEST P8D app code and install it on the emulator WITHOUT losing the
# login session, then open it. Every run => newest version, session preserved (goes straight to Home).
#
#   powershell -ExecutionPolicy Bypass -File .\update-volt.ps1
#   powershell -ExecutionPolicy Bypass -File .\update-volt.ps1 -NoBuild   # skip build, just (re)install newest APK + open
#
# Why not `p8 build`? It runs `adb uninstall` first (wipes login/device_id/DB) => forces a new
# single-use Staff Token + portal re-approval every time. This script builds the APK with the SAME
# toolchain but installs with `adb install -r`, which keeps app data => session survives.

param(
  [double]$Scale  = 0.40,       # emulator window size (fallback written to emulator-user.ini)
  [double]$Fill   = 0.92,       # window height as a fraction of the usable screen height
  [string]$Target = 'x86_64',   # emulator ABI (use 'aarch64' for a Kozen device)
  [switch]$NoBuild              # skip the build; just install the newest existing APK + open
)

# Continue (not Stop): native tools (node/tauri/adb) print progress to stderr, and under PS 5.1 with
# EAP=Stop that stderr is treated as a terminating error and would abort the script mid-build. We do
# our own error handling instead: `throw` on real failures + $LASTEXITCODE / 'Success' checks below.
$ErrorActionPreference = 'Continue'

$Avd      = 'P8_Dual'
$Serial   = 'emulator-5554'
$Emulator = 'C:\Android\Sdk\emulator\emulator.exe'
$Pkg      = 'com.fastboy.volt_pos'
$AppRepo  = 'D:\Project\P8D\P8D'
$ApkRoot  = Join-Path $AppRepo 'src-tauri\gen\android\app\build\outputs\apk'
$ScriptDir= Split-Path -Parent $MyInvocation.MyCommand.Path
$UserIni  = Join-Path $env:USERPROFILE ".android\avd\$Avd.avd\emulator-user.ini"

# 1) Pin a fixed, large window size (window.scale = -1 "auto" -> tiny default). Pre-write each launch.
if (Test-Path $UserIni) {
  $c = Get-Content $UserIni -Raw
  if ($c -match 'window\.scale') {
    $c = $c -replace 'window\.scale\s*=.*', ("window.scale = {0:F6}" -f $Scale)
  } else {
    $c = $c.TrimEnd() + "`nwindow.scale = $("{0:F6}" -f $Scale)`n"
  }
  Set-Content -Path $UserIni -Value $c -Encoding ascii
}

# 2) Boot the emulator if it isn't running (non-blocking, so it boots WHILE we build).
$running = (& adb devices) -match $Serial
if (-not $running) {
  Write-Host "Booting $Avd (will boot while the APK builds) ..."
  Start-Process $Emulator -ArgumentList @('-avd', $Avd, '-dns-server', '8.8.8.8,8.8.4.4', '-no-snapshot-load')
} else {
  Write-Host "$Serial already running."
}

# 3) Build the LATEST APK (unless -NoBuild). Abort on failure so we never install a stale/half APK.
if (-not $NoBuild) {
  Write-Host "Building latest APK ($Target) ... (Rust + Vite + Gradle; a few minutes)"
  $env:P8D_APP_REPO = $AppRepo
  $env:P8D_TARGET   = $Target
  $mjs = Join-Path $ScriptDir 'build-android.mjs'
  # Run under cmd so stderr merges into stdout as plain text (no PS NativeCommandError noise); the
  # exit code from cmd is node's real exit code.
  & cmd /c "node `"$mjs`" 2>&1"
  if ($LASTEXITCODE -ne 0) { throw "Build FAILED (exit $LASTEXITCODE). App NOT updated." }
}

# 4) Make sure the device is fully up before installing.
& adb -s $Serial wait-for-device
do {
  Start-Sleep -Seconds 2
  $b = (& adb -s $Serial shell getprop sys.boot_completed 2>$null | Out-String).Trim()
} while ($b -ne '1')
if (-not $running) { Write-Host "Waiting for WiFi/DNS to associate ..."; Start-Sleep -Seconds 15 }

# 5) Install the newest APK with `-r` (KEEP app data => session survives). Never uninstall on failure.
$apk = Get-ChildItem -Path $ApkRoot -Recurse -Filter *.apk -ErrorAction Stop |
       Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $apk) { throw "No .apk found under $ApkRoot (build did not produce one)." }
Write-Host "Installing (keep data): $($apk.FullName)"

# Run adb under cmd so stderr merges into text (avoids PowerShell NativeCommandError) and $LASTEXITCODE
# is adb's real exit code. Success prints 'Success'; retry smartly on the two known transient failures.
function Install-Apk([string]$extra) {
  $o = & cmd /c "adb -s $Serial install -r $extra `"$($apk.FullName)`" 2>&1"
  return ($o | Out-String)
}
$out = Install-Apk ''
Write-Host $out.Trim()
if ($out -notmatch 'Success') {
  if ($out -match 'VERSION_DOWNGRADE') {
    Write-Host "-> version downgrade; retrying with -d (still keeps data) ..."
    $out = Install-Apk '-d'; Write-Host $out.Trim()
  } elseif ($out -match 'INSTALL_PARSE_FAILED|Streamed|broken pipe|closed') {
    Write-Host "-> streamed install issue; retrying with --no-streaming ..."
    $out = Install-Apk '--no-streaming'; Write-Host $out.Trim()
  }
  if ($out -notmatch 'Success') {
    throw "install -r failed (see above). NOT uninstalling - that would wipe the session. If it is a signature mismatch, run 'p8 build' once (that accepts a re-login)."
  }
}

# 6) Open the app (persisted session -> straight to Home) and size the emulator window.
& adb -s $Serial shell am force-stop $Pkg
& adb -s $Serial shell monkey -p $Pkg -c android.intent.category.LAUNCHER 1 | Out-Null
Write-Host "Volt POS launched on $Serial."

Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class EmuWin {
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool repaint);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@

$wa      = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$margin  = 20
$targetH = [int][Math]::Min($wa.Height * $Fill, $wa.Height - $margin)
$targetW = [int]($targetH * 0.47)
$x       = $wa.X + $margin
$y       = $wa.Y + $margin
$find = {
  Get-Process | Where-Object {
    $_.MainWindowHandle -ne 0 -and
    (($_.MainWindowTitle -match [regex]::Escape($Avd)) -or ($_.MainWindowTitle -match '5554'))
  } | Select-Object -First 1
}
$p = $null
for ($i = 0; $i -lt 30 -and -not $p; $i++) { $p = & $find; if (-not $p) { Start-Sleep -Seconds 1 } }
if ($p) {
  for ($j = 0; $j -lt 5; $j++) { [void][EmuWin]::MoveWindow($p.MainWindowHandle, $x, $y, $targetW, $targetH, $true); Start-Sleep -Milliseconds 600 }
  [void][EmuWin]::SetForegroundWindow($p.MainWindowHandle)
}

# 7) Report the version now installed.
$ver = (& adb -s $Serial shell dumpsys package $Pkg 2>$null | Select-String 'versionName=|versionCode=') -join '   '
Write-Host ""
Write-Host "DONE. Installed -> $($ver.Trim())"
Write-Host "Session kept: the app should open straight to Home (no login/approval)."
