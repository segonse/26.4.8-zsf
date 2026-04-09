# 产品背书资料展示页

温州鸿业健身器材有限公司 — 产品专利与参数背书展示

## 文件说明

| 文件 | 说明 |
|------|------|
| `FC789-1.html` | FC789-1 产品详情页（B档展示版，主要交付物） |
| `FC789-1-basic.html` | FC789-1 产品详情页（A档基础版，报价对比用） |
| `index.html` | 首页（手动输入型号查询，NFC 降级方案） |
| `admin.html` | URL 管理页（内部使用，复制 URL 写入 NFC 标签） |
| `ASSETS-CHECKLIST.md` | 上线前需收齐的资源清单 |
| `css/style.css` | 自定义补充样式 |
| `images/` | 产品图片和证书缩略图 |
| `certificates/` | 证书 PDF 文件 |
| `nginx/site.conf` | Nginx 站点配置参考 |
| `deploy.sh` | 服务器端一键部署/更新脚本 |

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
3. 在服务器上拉取更新：
   ```bash
   cd /var/www/product-credential-site
   git pull
   ```
   或直接运行：`bash deploy.sh`

## 新增产品

1. 复制 `FC789-1.html`，重命名为新型号（如 `FC789-2.html`）
2. 修改文件内的所有产品数据
3. 在 `admin.html` 的 `products` 数组中追加新条目：
   ```js
   { model: 'FC789-2', name: '产品名称', file: 'FC789-2.html', version: 'B档展示版' }
   ```
4. 提交推送 + 服务器拉取

## 首次部署到服务器

```bash
# 1. SSH 连接到服务器
ssh user@服务器IP

# 2. 安装必要软件
sudo apt update
sudo apt install -y nginx git

# 3. 运行部署脚本（先编辑 deploy.sh 填写 REPO_URL）
bash deploy.sh

# 4. 配置 Nginx
sudo cp /var/www/product-credential-site/nginx/site.conf /etc/nginx/sites-available/product-credential
# 编辑配置文件，替换"域名"为实际域名
sudo nano /etc/nginx/sites-available/product-credential
sudo ln -s /etc/nginx/sites-available/product-credential /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 5. 配置 HTTPS（强烈推荐，NFC 跳转需要 HTTPS）
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名
```

## 待确认事项（上线前需解决）

- [ ] 充电时长具体数值
- [ ] 产品尺寸单位（mm 还是 cm）
- [ ] 海关备案编号（如有）
- [ ] 客户提供原始 PDF 证书文件
- [ ] 域名注册 + ICP 备案（如使用国内服务器）
