#!/bin/bash
# deploy.sh — 服务器端部署/更新脚本
# 用法：bash deploy.sh
# 首次运行：克隆仓库并配置权限
# 后续运行：拉取最新代码

set -e

REPO_URL="https://github.com/你的用户名/product-credential-site.git"
DEPLOY_DIR="/var/www/product-credential-site"

echo "==============================="
echo "  产品背书页面 部署/更新脚本"
echo "==============================="

if [ ! -d "$DEPLOY_DIR/.git" ]; then
    echo "[首次部署] 正在克隆仓库..."
    sudo mkdir -p "$DEPLOY_DIR"
    sudo chown "$(whoami):$(whoami)" "$DEPLOY_DIR"
    git clone "$REPO_URL" "$DEPLOY_DIR"
    echo "[首次部署] 克隆完成。"
else
    echo "[更新] 正在拉取最新代码..."
    cd "$DEPLOY_DIR"
    git pull origin main
    echo "[更新] 完成。"
fi

echo "[依赖] 正在安装 Node.js 依赖..."
cd "$DEPLOY_DIR"
npm install --production

echo "[进程] 正在重启 Node.js 服务..."
if pm2 list | grep -q "product-credential-site"; then
    pm2 reload ecosystem.config.js --update-env
else
    pm2 start ecosystem.config.js
fi
pm2 save

echo "[权限] 正在设置文件权限..."
sudo chown -R www-data:www-data "$DEPLOY_DIR"
sudo chmod -R 755 "$DEPLOY_DIR"
# 恢复 Node.js 进程用户的写权限（用于 data/ 目录）
sudo chown -R "$(whoami):$(whoami)" "$DEPLOY_DIR/data"
sudo chown -R "$(whoami):$(whoami)" "$DEPLOY_DIR/images"
sudo chown -R "$(whoami):$(whoami)" "$DEPLOY_DIR/certificates"

echo "==============================="
echo "  部署完成！"
echo "  站点目录：$DEPLOY_DIR"
echo "  服务端口：55789（由 Nginx 反代）"
echo "==============================="
