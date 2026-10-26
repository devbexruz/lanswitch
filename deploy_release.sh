#!/bin/bash
set -e

ServerIP="16.170.215.250"
ServerUser="ubuntu"
if [ -f "$HOME/.ssh/lanswitch.pem" ]; then
    PemFilePath="$HOME/.ssh/lanswitch.pem"
else
    PemFilePath="/home/bexruz/Documents/MyProjects/lanswitch/lanswitch.pem"
fi

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLISH_DIR="${PROJECT_ROOT}/publish_release"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}======================================================${NC}"
echo -e "${GREEN}   LANSWITCH RELEASE DEPLOY (FRONTEND & BACKEND)      ${NC}"
echo -e "${CYAN}======================================================${NC}"

# 1. Frontend build va serverga yuklash
echo -e "${YELLOW}1. Frontend (web) build qilinmoqda...${NC}"
npm --prefix "${PROJECT_ROOT}/web" run build

echo -e "${YELLOW}2. Frontend fayllari serverga (/var/www/lanswitch.developerlogic.uz) yuklanmoqda...${NC}"
rsync -avz \
    -e "ssh -F /dev/null -i ${PemFilePath} -o StrictHostKeyChecking=no" \
    "${PROJECT_ROOT}/web/dist/" \
    "${ServerUser}@${ServerIP}:/var/www/lanswitch.developerlogic.uz/"

rsync -avz \
    -e "ssh -F /dev/null -i ${PemFilePath} -o StrictHostKeyChecking=no" \
    "${PROJECT_ROOT}/web/dist/" \
    "${ServerUser}@${ServerIP}:/home/ubuntu/projects/FrontendBuildings/lanswitch.developerlogic.uz/"

# 2. Backend Release build va serverga yuklash
echo -e "${YELLOW}3. Backend Release (linux-x64, self-contained) build qilinmoqda...${NC}"
dotnet publish "${PROJECT_ROOT}/backend/Lanswitch.Api/Lanswitch.Api.csproj" \
    -c Release \
    -r linux-x64 \
    --self-contained true \
    -o "${PUBLISH_DIR}"

echo -e "${YELLOW}4. Backend publish fayllari serverga uzatilmoqda...${NC}"
rsync -avz --exclude 'appsettings.json' --exclude '*.session' --exclude '*.db*' \
    -e "ssh -F /dev/null -i ${PemFilePath} -o StrictHostKeyChecking=no" \
    "${PUBLISH_DIR}/" \
    "${ServerUser}@${ServerIP}:/home/ubuntu/projects/lanswitch/backend/Lanswitch.Api/publish/"

# 3. Serverdagi xizmatni ishga tushirish / qayta yuklash
echo -e "${YELLOW}5. Serverda lanswitch-api xizmati qayta ishga tushirilmoqda...${NC}"
ssh -F /dev/null -i "${PemFilePath}" -o StrictHostKeyChecking=no "${ServerUser}@${ServerIP}" \
    "sudo systemctl daemon-reload && sudo systemctl restart lanswitch-api && sudo systemctl status lanswitch-api --no-pager"

echo ""
echo -e "${GREEN}✅ Frontend va Backend muvaffaqiyatli serverga yuklandi va ishga tushirildi!${NC}"
echo -e "${CYAN}Frontend: https://lanswitch.developerlogic.uz/${NC}"
echo -e "${CYAN}Backend:  https://lanswitch.developerlogic.uz/api/scalar${NC}"
