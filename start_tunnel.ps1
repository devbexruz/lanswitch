# start_tunnel.ps1

$ServerIP = "16.170.215.250"
$ServerUser = "ubuntu"
$PemFilePath = "C:\Users\bexru\.ssh\lanswitch.pem"

# Portlar sozlamasi
$RemoteApiPort = 8080
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
Write-Host "Tunel ochilmoqda... (To'xtatish uchun CTRL+C bosing)" -ForegroundColor Magenta

# Ikkita portni bitta SSH buyrug'i bilan yo'naltiramiz
ssh -i "$PemFilePath" `
    -R ${RemoteApiPort}:localhost:${LocalApiPort} `
    -R ${RemoteFrontendPort}:localhost:${LocalFrontendPort} `
    ${ServerUser}@${ServerIP} -N -o ServerAliveInterval=60

Write-Host "Tunel yopildi." -ForegroundColor Red
Start-Sleep -Seconds 3