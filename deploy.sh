#!/bin/bash
# deploy.sh — 安装依赖、初始化存储目录、重启服务
# 用法：sudo APP_ROOT=/srv/apps/info.c.bimumedia.com/current bash deploy.sh

set -euo pipefail

APP_NAME="${APP_NAME:-product-credential-site}"
APP_ROOT="${APP_ROOT:-$(cd "$(dirname "$0")" && pwd)}"
APP_STORAGE_ROOT="${APP_STORAGE_ROOT:-/srv/data/info.c.bimumedia.com}"
SERVICE_NAME="${SERVICE_NAME:-$APP_NAME}"
APP_USER="${APP_USER:-www-data}"
APP_GROUP="${APP_GROUP:-www-data}"
PORT="${PORT:-18081}"
NODE_BIN="${NODE_BIN:-}"
NPM_BIN="${NPM_BIN:-}"
SYNC_PRODUCTS_DATA="${SYNC_PRODUCTS_DATA:-false}"

echo "==============================="
echo "  产品背书页面部署脚本"
echo "==============================="
echo "APP_ROOT=$APP_ROOT"
echo "APP_STORAGE_ROOT=$APP_STORAGE_ROOT"
echo "SERVICE_NAME=$SERVICE_NAME"
echo "SYNC_PRODUCTS_DATA=$SYNC_PRODUCTS_DATA"

if [ -z "$NODE_BIN" ] && command -v node >/dev/null 2>&1; then
    NODE_BIN="$(command -v node)"
fi

if [ -z "$NPM_BIN" ] && command -v npm >/dev/null 2>&1; then
    NPM_BIN="$(command -v npm)"
fi

if [ -z "$NPM_BIN" ] && [ -n "$NODE_BIN" ]; then
    NODE_DIR="$(dirname "$NODE_BIN")"
    if [ -x "$NODE_DIR/npm" ]; then
        NPM_BIN="$NODE_DIR/npm"
    fi
fi

if [ -n "$NODE_BIN" ]; then
    NODE_DIR="$(dirname "$NODE_BIN")"
    export PATH="$NODE_DIR:$PATH"
fi

if [ ! -f "$APP_ROOT/package.json" ]; then
    echo "错误：未在 $APP_ROOT 找到 package.json"
    exit 1
fi

echo "[目录] 初始化持久化目录..."
install -d -m 0750 -o "$APP_USER" -g "$APP_GROUP" "$APP_STORAGE_ROOT"
install -d -m 0750 -o "$APP_USER" -g "$APP_GROUP" "$APP_STORAGE_ROOT/data"
install -d -m 0750 -o "$APP_USER" -g "$APP_GROUP" "$APP_STORAGE_ROOT/images"
install -d -m 0750 -o "$APP_USER" -g "$APP_GROUP" "$APP_STORAGE_ROOT/certificates"
install -d -m 0750 -o "$APP_USER" -g "$APP_GROUP" "$APP_STORAGE_ROOT/sessions"

echo "[资源] 同步仓库内置静态资源到持久化目录..."
if [ -d "$APP_ROOT/images" ]; then
    cp -a "$APP_ROOT/images/." "$APP_STORAGE_ROOT/images/"
fi
if [ -d "$APP_ROOT/certificates" ]; then
    cp -a "$APP_ROOT/certificates/." "$APP_STORAGE_ROOT/certificates/"
fi
if [ "$SYNC_PRODUCTS_DATA" = "true" ] && [ -f "$APP_ROOT/data/products.json" ]; then
    cp -a "$APP_ROOT/data/products.json" "$APP_STORAGE_ROOT/data/products.json"
elif [ ! -f "$APP_STORAGE_ROOT/data/products.json" ] && [ -f "$APP_ROOT/data/products.json" ]; then
    cp -a "$APP_ROOT/data/products.json" "$APP_STORAGE_ROOT/data/products.json"
fi

echo "[迁移] 规范化产品数据结构..."
if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
    echo "错误：未找到可执行的 node，请通过 NODE_BIN 指定，或确保 PATH 中存在 node"
    exit 1
fi
"$NODE_BIN" "$APP_ROOT/scripts/migrate-products.js" "$APP_STORAGE_ROOT/data/products.json"

echo "[依赖] 安装生产依赖..."
cd "$APP_ROOT"
if [ -z "$NPM_BIN" ] || [ ! -x "$NPM_BIN" ]; then
    echo "错误：未找到可执行的 npm，请通过 NPM_BIN 指定，或确保 PATH 中存在 npm"
    exit 1
fi
if [ -f package-lock.json ]; then
    "$NPM_BIN" ci --omit=dev
else
    "$NPM_BIN" install --omit=dev --no-package-lock
fi

echo "[权限] 校正代码目录与数据目录权限..."
chown -R "$APP_USER:$APP_GROUP" "$APP_STORAGE_ROOT"
find "$APP_STORAGE_ROOT" -type d -exec chmod 750 {} \;
find "$APP_STORAGE_ROOT" -type f -exec chmod 640 {} \;

echo "[进程] 重启应用服务..."
if command -v systemctl >/dev/null 2>&1 && { [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ] || [ -f "/usr/lib/systemd/system/${SERVICE_NAME}.service" ]; }; then
    systemctl daemon-reload
    systemctl restart "$SERVICE_NAME"
    systemctl status "$SERVICE_NAME" --no-pager || true
elif command -v pm2 >/dev/null 2>&1; then
    APP_STORAGE_ROOT="$APP_STORAGE_ROOT" PORT="$PORT" COOKIE_SECURE="${COOKIE_SECURE:-true}" pm2 startOrReload ecosystem.config.js --update-env
    pm2 save
    pm2 status "$APP_NAME" || true
else
    echo "警告：未找到 systemd 服务 $SERVICE_NAME，也未安装 pm2，请手动启动应用。"
fi

echo "==============================="
echo "部署完成"
echo "Node 监听端口：$PORT"
echo "持久化目录：$APP_STORAGE_ROOT"
echo "==============================="
