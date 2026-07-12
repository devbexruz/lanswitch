# start_tunnel.ps1

$ServerIP = "16.170.215.250"
$ServerUser = "ubuntu"
$PemFilePath = "C:\Users\bexru\.ssh\lanswitch.pem"

# Portlar sozlamasi
$RemoteApiPort = 8081
$LocalApiPort = 5273
$RemoteFrontendPort = 5050
$LocalFrontendPort = 3000

Clear-Host
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   LANSWITCH TUNNEL (BACKEND & FRONTEND) " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Server: $ServerUser@$ServerIP" -ForegroundColor Yellow
Write-Host "1. Backend API: Server($RemoteApiPort) -> Local($LocalApiPort)" -ForegroundColor Gray
Write-Host "2. Frontend UI: Server($RemoteFrontendPort) -> Local($LocalFrontendPort)" -ForegroundColor Gray
Write-Host ""

# Avval eski SSH tunnel jarayonlarini to'xtatamiz (local)
Write-Host "Eski SSH tunnellar tozalanmoqda..." -ForegroundColor Yellow
Get-Process ssh -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Serverdagi band portlarni tozalaymiz
Write-Host "Serverdagi band portlar tozalanmoqda ($RemoteApiPort, $RemoteFrontendPort)..." -ForegroundColor Yellow
$cleanupCmd = "sudo lsof -ti :$RemoteApiPort -ti :$RemoteFrontendPort 2>/dev/null | xargs -r sudo kill -9; sleep 1; echo 'Ports cleared'"
ssh -i "$PemFilePath" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "${ServerUser}@${ServerIP}" $cleanupCmd
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Tunel ochilmoqda... (To'xtatish uchun CTRL+C bosing)" -ForegroundColor Magenta

# Ikkita portni bitta SSH buyrug'i bilan yo'naltiramiz
ssh -i "$PemFilePath" `
    -R ${RemoteApiPort}:localhost:${LocalApiPort} `
    -R ${RemoteFrontendPort}:localhost:${LocalFrontendPort} `
    ${ServerUser}@${ServerIP} -N -o ServerAliveInterval=60 -o ExitOnForwardFailure=yes

Write-Host "Tunel yopildi." -ForegroundColor Red
Start-Sleep -Seconds 3
