const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态资源
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/certificates', express.static(path.join(__dirname, 'certificates')));

// 后台路由（/admin/*）
app.use('/admin', require('./routes/admin'));

// 首页
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// A档静态版（保留向后兼容）
app.get('/FC789-1-basic.html', (req, res) =>
  res.sendFile(path.join(__dirname, 'FC789-1-basic.html')));

// 旧 admin.html → 重定向到新后台
app.get('/admin.html', (req, res) => res.redirect(301, '/admin'));

// 产品页路由（/:model 和 /:model.html）
app.use('/', require('./routes/product'));

// 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
