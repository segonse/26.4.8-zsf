const fs = require('fs');
const path = require('path');

const APP_ROOT = path.resolve(__dirname, '..');

function resolveConfiguredPath(value, fallbackPath) {
  if (!value) return fallbackPath;
  return path.isAbsolute(value) ? value : path.join(APP_ROOT, value);
}

const STORAGE_ROOT = resolveConfiguredPath(
  process.env.APP_STORAGE_ROOT,
  APP_ROOT
);

const DATA_DIR = resolveConfiguredPath(
  process.env.APP_DATA_DIR,
  path.join(STORAGE_ROOT, 'data')
);

const IMAGES_DIR = resolveConfiguredPath(
  process.env.APP_IMAGES_DIR,
  path.join(STORAGE_ROOT, 'images')
);

const CERTIFICATES_DIR = resolveConfiguredPath(
  process.env.APP_CERTIFICATES_DIR,
  path.join(STORAGE_ROOT, 'certificates')
);

const SESSIONS_DIR = resolveConfiguredPath(
  process.env.APP_SESSIONS_DIR,
  path.join(STORAGE_ROOT, 'sessions')
);

const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ADMIN_AUTH_FILE = path.join(DATA_DIR, 'admin-auth.json');
const SESSION_SECRET_FILE = path.join(DATA_DIR, 'session-secret.txt');

function ensureRuntimeDirectories() {
  [DATA_DIR, IMAGES_DIR, CERTIFICATES_DIR, SESSIONS_DIR].forEach((dir) => {
    fs.mkdirSync(dir, { recursive: true });
  });
}

module.exports = {
  APP_ROOT,
  STORAGE_ROOT,
  DATA_DIR,
  IMAGES_DIR,
  CERTIFICATES_DIR,
  SESSIONS_DIR,
  PRODUCTS_FILE,
  ADMIN_AUTH_FILE,
  SESSION_SECRET_FILE,
  ensureRuntimeDirectories
};
