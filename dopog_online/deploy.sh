#!/bin/bash
set -e
echo "=== [1/3] Установка Docker на Ubuntu ==="
if ! command -v docker &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg lsb-release
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

echo "=== [2/3] Запуск сервиса ДОПОГ Экспресс ==="
docker compose down || true
docker compose up -d --build

echo "=== [3/3] Готово! ==="
IP=$(hostname -I | awk '{print $1}')
echo ""
echo "🚀 Сервис запущен: http://$IP"
echo "👤 Демо-логин: admin@dopog.ru"
echo "🔑 Демо-пароль: admin123"