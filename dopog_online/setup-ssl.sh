#!/bin/bash
set -e

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
    echo "Ошибка: укажите домен. Пример запуска: ./setup-ssl.sh moy-domen.ru"
    exit 1
fi

echo "=== [1/3] Установка Nginx и Certbot ==="
apt update && apt install -y nginx certbot python3-certbot-nginx

echo "=== [2/3] Настройка конфигурации Nginx для $DOMAIN ==="
cat <<EOF > /etc/nginx/sites-available/dopog
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/dopog /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl restart nginx

echo "=== [3/3] Выпуск бесплатного SSL-сертификата ==="
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN"

echo ""
echo "✓ Готово! Защищенный сайт работает: https://$DOMAIN"