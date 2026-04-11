const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const { loadAdminCredentials, verifyAdminCredentials } = require('./lib/admin-auth');
const app = express();
const PORT = process.env.PORT || 3000;
const adminCredentials = loadAdminCredentials();
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  name: 'product_admin_session',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 1000 * 60 * 60 * 12
  }
}));

// 静态资源
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/certificates', express.static(path.join(__dirname, 'certificates')));

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdminAuthenticated) {
    return next();
  }
  if (req.originalUrl.startsWith('/admin/api/')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.method === 'GET') {
    req.session.returnTo = req.originalUrl;
  }
  return res.redirect('/login');
}

app.get('/login', (req, res) => {
  if (req.session && req.session.isAdminAuthenticated) {
    return res.redirect('/admin');
  }
  res.render('login', { error: null, lastUsername: adminCredentials.username });
});

app.post('/login', (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';
  if (!verifyAdminCredentials(adminCredentials, username, password)) {
    return res.status(401).render('login', {
      error: 'Invalid username or password',
      lastUsername: username || adminCredentials.username
    });
  }

  req.session.isAdminAuthenticated = true;
  req.session.adminUsername = adminCredentials.username;
  const returnTo = req.session.returnTo || '/admin';
  delete req.session.returnTo;
  return res.redirect(returnTo);
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// 后台路由（/admin/*）
app.use('/admin', requireAuth, require('./routes/admin'));

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
