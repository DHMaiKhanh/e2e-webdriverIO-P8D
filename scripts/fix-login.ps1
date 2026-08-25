# fix-login.ps1
# Fix man hinh "Please contact support for assistance." tren emulator P8_Dual.
# Nguyen nhan (da xac nhan): refresh token het han -> app nhan 401 tren /refresh_token
# -> tu xoa session -> lang lai o man "contact support" thay vi quay ve QR login.
# Force-stop + relaunch la cach duy nhat de quay lai man QR/staff-token (khong phai
# loi backend, khong can p8 build).
#
# Cach dung:
#   powershell -ExecutionPolicy Bypass -File .\scripts\fix-login.ps1
#     -> dua app ve man "Enter Staff Token", ban tu go token (tu Portal) roi bam Sign in.
#
#   powershell -ExecutionPolicy Bypass -File .\scripts\fix-login.ps1 -Token "abcd1234"
#     -> tu dong go token va bam Sign in luon (token la single-use, lay tu Portal truoc).
#
# Luu y: token chi dung duoc 1 lan. Neu sau khi Sign in van bi 403 "Waiting for
# device approval from portal..." thi day la buoc rieng, phai cho admin duyet
# device tren GCI Business portal (khong lam duoc tu emulator/script).

param(
  [string]$Serial = 'emulator-5554',
  [string]$Pkg    = 'com.fastboy.volt_pos.debug',  # debug builds get applicationIdSuffix ".debug" now
  [string]$Token  = ''
)

$ErrorActionPreference = 'Stop'

function Invoke-Adb {
  param([string[]]$CmdArgs)
  & adb -s $Serial @CmdArgs
}

Write-Host "-> Force-stop $Pkg (xoa man contact-support, KHONG mat device_id)..." -ForegroundColor Cyan
Invoke-Adb @('shell', 'am', 'force-stop', $Pkg)
Start-Sleep -Seconds 1

Write-Host "-> Mo lai app..." -ForegroundColor Cyan
Invoke-Adb @('shell', 'monkey', '-p', $Pkg, '-c', 'android.intent.category.LAUNCHER', '1') | Out-Null
Start-Sleep -Seconds 4

$shotDir = Join-Path $PSScriptRoot '..\reports\screenshots'
New-Item -ItemType Directory -Force -Path $shotDir | Out-Null

Write-Host "-> Chup man hinh QR login de kiem tra..." -ForegroundColor Cyan
Invoke-Adb @('shell', 'screencap', '-p', '/sdcard/fix-login-1-qr.png') | Out-Null
Invoke-Adb @('pull', '/sdcard/fix-login-1-qr.png', (Join-Path $shotDir 'fix-login-1-qr.png')) | Out-Null

Write-Host "-> 5x tap nhanh vao icon QR (secret tap) de sang man Staff Token..." -ForegroundColor Cyan
# Icon o giua man hinh khi QR con "live" (~540,660) tren may 1080x2400.
# Phai lam trong 1 lenh adb de khong vuot qua cua so 500ms giua cac tap.
Invoke-Adb @('shell', 'input tap 540 660; input tap 540 660; input tap 540 660; input tap 540 660; input tap 540 660')
Start-Sleep -Seconds 1

Invoke-Adb @('shell', 'screencap', '-p', '/sdcard/fix-login-2-token-screen.png') | Out-Null
Invoke-Adb @('pull', '/sdcard/fix-login-2-token-screen.png', (Join-Path $shotDir 'fix-login-2-token-screen.png')) | Out-Null

if ([string]::IsNullOrWhiteSpace($Token)) {
  Write-Host ""
  Write-Host "Da xong phan tu dong. Kiem tra screenshot:" -ForegroundColor Green
  Write-Host "  $shotDir\fix-login-2-token-screen.png"
  Write-Host "Neu dang o man 'Enter Staff Token' -> go token moi (tu Portal) va bam Sign in tren emulator." -ForegroundColor Yellow
  Write-Host "Lan sau muon tu dong luon, chay: .\scripts\fix-login.ps1 -Token <token-moi>" -ForegroundColor Yellow
  exit 0
}

Write-Host "-> Go staff token va bam Sign in..." -ForegroundColor Cyan
Invoke-Adb @('shell', 'input', 'tap', '540', '1338')
Start-Sleep -Milliseconds 300
Invoke-Adb @('shell', 'input', 'text', $Token)
Start-Sleep -Milliseconds 300

Invoke-Adb @('shell', 'screencap', '-p', '/sdcard/fix-login-3-token-filled.png') | Out-Null
Invoke-Adb @('pull', '/sdcard/fix-login-3-token-filled.png', (Join-Path $shotDir 'fix-login-3-token-filled.png')) | Out-Null
Write-Host "-> Kiem tra da go dung token: $shotDir\fix-login-3-token-filled.png" -ForegroundColor Yellow

Invoke-Adb @('shell', 'input', 'tap', '540', '1210')
Start-Sleep -Seconds 2

Write-Host "-> Da bam Sign in. Neu van thay 'Waiting for device approval from portal...' thi phai cho admin duyet device tren GCI Business portal (khong sua duoc tu script)." -ForegroundColor Green
