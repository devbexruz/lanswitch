#!/bin/bash

ServerIP="16.170.215.250"
ServerUser="ubuntu"
if [ -f "$HOME/.ssh/lanswitch.pem" ]; then
    PemFilePath="$HOME/.ssh/lanswitch.pem"
else
    PemFilePath="/home/bexruz/Documents/MyProjects/lanswitch/lanswitch.pem"
fi

# Portlar sozlamasi
# lanswitch.developerlogic.uz /api/ -> 8080
# demoweb.developerlogic.uz /api/   -> 8081
# demoweb.developerlogic.uz /       -> 5050
LocalApiPort=5273
LocalFrontendPort=3000

# Ranglar
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
GRAY='\033[0;37m'
MAGENTA='\033[0;35m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}===================================================${NC}"
echo -e "${GREEN}   LANSWITCH TUNNEL (BACKEND & FRONTEND)           ${NC}"
echo -e "${CYAN}===================================================${NC}"
echo ""
echo -e "${YELLOW}Server: ${ServerUser}@${ServerIP}${NC}"
echo -e "${GRAY}1. lanswitch.developerlogic.uz/api/ -> Server(8080) -> Local(${LocalApiPort})${NC}"
echo -e "${GRAY}2. demoweb.developerlogic.uz/api/   -> Server(8081) -> Local(${LocalApiPort})${NC}"
echo -e "${GRAY}3. demoweb.developerlogic.uz/       -> Server(5050) -> Local(${LocalFrontendPort})${NC}"
echo ""

# Avval lokal SSH tunnel jarayonlarini to'xtatamiz
echo -e "${YELLOW}Eski lokal SSH tunnellar tozalanmoqda...${NC}"
pkill -f "ssh.*-R.*${ServerIP}" 2>/dev/null || true
sleep 1

# Serverdagi lanswitch-api xizmatini to'xtatamiz va portlarni tozalaymiz
echo -e "${YELLOW}Serverdagi lanswitch-api xizmati to'xtatilmoqda va portlar tozalanmoqda...${NC}"
cleanupCmd="sudo systemctl stop lanswitch-api 2>/dev/null || true; sudo lsof -ti :8080 -ti :8081 -ti :5050 2>/dev/null | xargs -r sudo kill -9; sleep 1; echo 'Ports 8080, 8081, 5050 cleared'"
ssh -F /dev/null -i "$PemFilePath" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "${ServerUser}@${ServerIP}" "$cleanupCmd"
sleep 2

echo ""
echo -e "${MAGENTA}Tunel ochilmoqda... (To'xtatish uchun CTRL+C bosing)${NC}"

# Portlarni SSH orqali yo'naltiramiz
ssh -F /dev/null -i "$PemFilePath" \
    -R 8080:localhost:${LocalApiPort} \
    -R 8081:localhost:${LocalApiPort} \
    -R 5050:localhost:${LocalFrontendPort} \
    ${ServerUser}@${ServerIP} -N -o ServerAliveInterval=60 -o ExitOnForwardFailure=yes

echo -e "${RED}Tunel yopildi.${NC}"
sleep 1