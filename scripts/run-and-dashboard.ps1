$ErrorActionPreference = 'SilentlyContinue'
Set-Location $PSScriptRoot\..

Write-Host "-> Don zombie Appium (cong 4723)..." -ForegroundColor Cyan
Get-NetTCPConnection -LocalPort 4723 -State Listen |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'appium' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

Write-Host "-> Kiem tra backend :8080..." -ForegroundColor Cyan
try {
  Invoke-WebRequest -Uri http://localhost:8080 -UseBasicParsing -TimeoutSec 3 | Out-Null
  Write-Host "Backend :8080 OK" -ForegroundColor Green
} catch {
  Write-Host "CANH BAO: Backend :8080 DOWN — hay start backend truoc khi chay test!" -ForegroundColor Red
}

Write-Host "-> Xoa ket qua cu..." -ForegroundColor Cyan
Remove-Item -Recurse -Force reports\allure-results -ErrorAction SilentlyContinue

Write-Host "-> Chay toan bo test Android..." -ForegroundColor Cyan
npm run test:android:emu
if ($LASTEXITCODE -ne 0) {
  Write-Host "CANH BAO: Test run khong chay het (exit $LASTEXITCODE) — dashboard se chi hien phan da chay." -ForegroundColor Red
}

Write-Host "-> Mo dashboard..." -ForegroundColor Cyan
Set-Location dashboard
npm run dev
