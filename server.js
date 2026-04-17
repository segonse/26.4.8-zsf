const express = require('express');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');
const {
  APP_ROOT,
  IMAGES_DIR,
  CERTIFICATES_DIR,
  PRODUCTS_FILE,
  SESSIONS_DIR,
  ensureRuntimeDirectories
} = require('./lib/runtime-paths');
const { normalizeProductsData } = require('./lib/product-schema');

ensureRuntimeDirectories();

const { loadAdminCredentials, verifyAdminCredentials } = require('./lib/admin-auth');
const { loadSessionSecret } = require('./lib/session-secret');
const app = express();
const PORT = process.env.PORT || 3000;
const adminCredentials = loadAdminCredentials();
const sessionSecret = loadSessionSecret();

app.set('view engine', 'ejs');
app.set('views', path.join(APP_ROOT, 'views'));
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  name: 'product_admin_session',
  secret: sessionSecret,
  store: new FileStore({
    path: SESSIONS_DIR,
    ttl: 60 * 60 * 12,
    reapInterval: 60 * 60,
    retries: 0,
    logFn() {}
  }),
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
app.use('/css', express.static(path.join(APP_ROOT, 'css')));
app.use('/images', express.static(IMAGES_DIR));
app.use('/certificates', express.static(CERTIFICATES_DIR));
if (IMAGES_DIR !== path.join(APP_ROOT, 'images')) {
  app.use('/images', express.static(path.join(APP_ROOT, 'images')));
}
if (CERTIFICATES_DIR !== path.join(APP_ROOT, 'certificates')) {
  app.use('/certificates', express.static(path.join(APP_ROOT, 'certificates')));
}

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    return res.status(429).render('login', {
      error: 'Too many login attempts. Please try again later.',
      lastUsername: (req.body && req.body.username) || adminCredentials.username
    });
  }
});

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

app.post('/login', loginRateLimiter, (req, res) => {
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

function getDefaultProductPath() {
  if (process.env.DEFAULT_PRODUCT_MODEL) {
    return `/${process.env.DEFAULT_PRODUCT_MODEL}`;
  }

  try {
    if (!fs.existsSync(PRODUCTS_FILE)) return null;
    const { products } = normalizeProductsData(JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8')));
    if (products[0] && products[0].model) {
      return `/${products[0].model}`;
    }
  } catch (error) {
    console.error('[product] Failed to resolve default product path:', error.message);
  }

  return null;
}

// 首页
app.get('/healthz', (req, res) => res.status(200).json({ ok: true }));

app.get('/', (req, res) => {
  const defaultProductPath = getDefaultProductPath();
  if (defaultProductPath) {
    return res.redirect(302, defaultProductPath);
  }
  return res.sendFile(path.join(APP_ROOT, 'index.html'));
});

app.get('/index.html', (req, res) => {
  const defaultProductPath = getDefaultProductPath();
  if (defaultProductPath) {
    return res.redirect(302, defaultProductPath);
  }
  return res.sendFile(path.join(APP_ROOT, 'index.html'));
});

// A档静态版（保留向后兼容）
app.get('/FC789-1-basic.html', (req, res) =>
  res.sendFile(path.join(APP_ROOT, 'FC789-1-basic.html')));

// 旧 admin.html → 重定向到新后台
app.get('/admin.html', (req, res) => res.redirect(301, '/admin'));

// 产品页路由（/:model 和 /:model.html）
app.use('/', require('./routes/product'));

// 404
app.use((req, res) => {
  res.status(404).type('text/plain').send('Not Found');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
