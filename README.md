# 产品背书资料展示页

温州鸿业健身器材有限公司产品专利与参数背书展示站。

当前仓库已按单机生产部署方式整理：

- Web 层：`Nginx` 统一监听 `80/443`
- 应用层：`Node.js + Express + EJS`
- 进程管理：优先 `systemd`，`pm2` 仅作临时兼容
- 持久化：产品数据、上传图片、PDF 证书独立放在代码目录外

当前这台服务器的 Node.js 已通过 `nvm` 安装在 `/root/.nvm/versions/node/v24.14.1/bin/node`。
因此仓库内的 `systemd` 模板已按这一路径适配，服务默认以 `root:www-data` 运行，方便访问 `nvm` 二进制同时让 Nginx 正常读取静态文件。

## 文件说明

| 文件 | 说明 |
|------|------|
| `FC789-1.html` | FC789-1 产品详情页（B档展示版，主要交付物） |
| `FC789-1-basic.html` | FC789-1 产品详情页（A档基础版，报价对比用） |
| `index.html` | 首页（手动输入型号查询，NFC 降级方案） |
| `admin.html` | 旧后台入口，现已 301 跳转到 `/admin` |
| `ASSETS-CHECKLIST.md` | 上线前需收齐的资源清单 |
| `css/style.css` | 自定义补充样式 |
| `data/` | 本地开发默认数据目录 |
| `images/` | 本地开发默认图片目录 |
| `certificates/` | 本地开发默认 PDF 目录 |
| `nginx/site.conf` | 生产 Nginx 站点模板 |
| `systemd/product-credential-site.service` | 生产 `systemd` 服务模板 |
| `systemd/product-credential-site.env.example` | 生产环境变量示例 |
| `deploy.sh` | 安装依赖、初始化持久化目录、重启服务 |

## 运行时目录设计

本项目默认兼容本地开发目录结构，但生产环境建议通过 `APP_STORAGE_ROOT` 将可写目录拆到代码目录之外：

```text
/srv/apps/info.c.bimumedia.com/current
/srv/data/info.c.bimumedia.com/data
/srv/data/info.c.bimumedia.com/images
/srv/data/info.c.bimumedia.com/certificates
```

支持的环境变量：

| 变量 | 说明 |
|------|------|
| `PORT` | Node.js 监听端口，推荐 `18081` |
| `APP_ROOT` | 代码目录，供 `systemd` 启动脚本使用 |
| `NODE_BIN` | Node.js 可执行文件路径，当前机器是 `/root/.nvm/versions/node/v24.14.1/bin/node` |
| `COOKIE_SECURE` | HTTPS 环境下设为 `true` |
| `APP_STORAGE_ROOT` | 持久化根目录，生产环境强烈建议设置 |
| `APP_DATA_DIR` | 可选，覆盖默认 `APP_STORAGE_ROOT/data` |
| `APP_IMAGES_DIR` | 可选，覆盖默认 `APP_STORAGE_ROOT/images` |
| `APP_CERTIFICATES_DIR` | 可选，覆盖默认 `APP_STORAGE_ROOT/certificates` |
| `ADMIN_USERNAME` | 后台用户名 |
| `ADMIN_PASSWORD` | 后台密码 |
| `SESSION_SECRET` | Session 密钥 |

## NFC 使用流程

1. 打开 `admin.html`，填写实际域名
2. 复制对应产品的 URL（如 `https://域名/FC789-1.html`）
3. 用 NFC 写入 App（推荐 NFC Tools）将 URL 写入标签
4. 手机碰标签测试跳转是否正常

## 日常更新内容

1. 本地修改对应文件（如更新参数、替换图片）
2. 提交并推送到 GitHub：
   ```bash
   git add .
   git commit -m "更新说明，例如：补充充电时长参数"
   git push
   ```
3. 在服务器上更新代码：
   ```bash
   cd /srv/apps/info.c.bimumedia.com/current
   git pull
   ```
4. 在服务器上执行部署脚本：
   ```bash
   sudo APP_ROOT=/srv/apps/info.c.bimumedia.com/current \
     APP_STORAGE_ROOT=/srv/data/info.c.bimumedia.com \
     SERVICE_NAME=product-credential-site \
     bash deploy.sh
   ```

## 新增产品

1. 复制 `FC789-1.html`，重命名为新型号（如 `FC789-2.html`）
2. 修改文件内的所有产品数据
3. 在 `admin.html` 的 `products` 数组中追加新条目：
   ```js
   { model: 'FC789-2', name: '产品名称', file: 'FC789-2.html', version: 'B档展示版' }
   ```
4. 提交推送 + 服务器拉取

## 首次部署到服务器

### 1. 新机初始化建议

```bash
sudo apt update
sudo apt install -y nginx git curl

# 2G 机器建议至少补 1G swap，避免安装依赖或多项目并存时 OOM
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2. 推荐目录结构

```bash
sudo mkdir -p /srv/apps/info.c.bimumedia.com
sudo mkdir -p /srv/data/info.c.bimumedia.com
sudo git clone <你的仓库地址> /srv/apps/info.c.bimumedia.com/current
```

### 3. 配置应用环境变量

```bash
sudo mkdir -p /etc/product-credential-site
sudo cp systemd/product-credential-site.env.example \
  /etc/product-credential-site/info.c.bimumedia.com.env
sudo nano /etc/product-credential-site/info.c.bimumedia.com.env
```

其中至少确认：

```text
APP_ROOT=/srv/apps/info.c.bimumedia.com/current
NODE_BIN=/root/.nvm/versions/node/v24.14.1/bin/node
PORT=18081
```

### 4. 安装 systemd 服务

```bash
sudo cp systemd/product-credential-site.service \
  /etc/systemd/system/product-credential-site.service
sudo nano /etc/systemd/system/product-credential-site.service
sudo systemctl daemon-reload
sudo systemctl enable product-credential-site
```

说明：

- 当前模板默认 `User=root`，因为这台机器的 `node` 在 `/root/.nvm/...`
- 如果后续改成系统级 Node，或把 `nvm` 安装到专门部署用户下，再把服务用户收回到普通用户即可

### 5. 执行部署脚本

```bash
cd /srv/apps/info.c.bimumedia.com/current
sudo APP_ROOT=/srv/apps/info.c.bimumedia.com/current \
  APP_STORAGE_ROOT=/srv/data/info.c.bimumedia.com \
  SERVICE_NAME=product-credential-site \
  bash deploy.sh
```

### 6. 配置 Nginx 与 HTTPS

```bash
sudo cp nginx/site.conf /etc/nginx/sites-available/info.c.bimumedia.com
sudo nano /etc/nginx/sites-available/info.c.bimumedia.com
sudo ln -s /etc/nginx/sites-available/info.c.bimumedia.com /etc/nginx/sites-enabled/info.c.bimumedia.com
sudo nginx -t
sudo systemctl reload nginx
```

如果使用 Let’s Encrypt：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d info.c.bimumedia.com
```

如果使用现成证书包，请将证书和私钥放到：

```text
/etc/nginx/ssl/info.c.bimumedia.com/fullchain.pem
/etc/nginx/ssl/info.c.bimumedia.com/privkey.pem
```

### 7. 验证

```bash
source /root/.nvm/nvm.sh
node -v
npm -v
curl -I http://info.c.bimumedia.com
curl -k https://info.c.bimumedia.com/healthz
sudo systemctl status product-credential-site --no-pager
sudo nginx -t
```

## 运维建议

- 后台路径 `/admin`、`/login`、`/logout` 建议在 Nginx 做固定办公 IP 白名单
- 备份范围至少包括 `products.json`、`images/`、`certificates/`
- 日志优先看 `journalctl -u product-credential-site -n 100`
- 未来同机新项目继续走 `Nginx 统一 80/443 + 每项目一个 localhost 端口` 模式

## 待确认事项（上线前需解决）

- [ ] 充电时长具体数值
- [ ] 生产日期（当前页面已预留字段，待客户提供具体日期）
- [ ] 产品尺寸单位（mm 还是 cm）
- [ ] 海关备案编号（如有）
- [ ] 客户提供原始 PDF 证书文件
- [ ] 域名注册 + ICP 备案（如使用国内服务器）
