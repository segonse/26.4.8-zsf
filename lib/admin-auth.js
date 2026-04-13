const crypto = require('crypto');
const fs = require('fs');
const {
  ADMIN_AUTH_FILE: AUTH_FILE,
  ensureRuntimeDirectories
} = require('./runtime-paths');

function safeCompare(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function writeLocalAuthFile(config) {
  ensureRuntimeDirectories();
  fs.writeFileSync(AUTH_FILE, JSON.stringify(config, null, 2), {
    encoding: 'utf8',
    mode: 0o600
  });
}

function buildLocalAuthConfig() {
  ensureRuntimeDirectories();
  if (fs.existsSync(AUTH_FILE)) {
    return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  }

  const config = {
    username: 'admin',
    password: crypto.randomBytes(12).toString('base64url')
  };
  writeLocalAuthFile(config);
  console.warn('[auth] Created local admin credentials at:', AUTH_FILE);
  console.warn('[auth] Username:', config.username);
  console.warn('[auth] Password:', config.password);
  console.warn('[auth] Change or remove this file after first login if needed.');
  return config;
}

function loadAdminCredentials() {
  const envUsername = process.env.ADMIN_USERNAME;
  const envPassword = process.env.ADMIN_PASSWORD;
  if (envUsername && envPassword) {
    return {
      username: envUsername,
      password: envPassword,
      source: 'env'
    };
  }

  const fileConfig = buildLocalAuthConfig();
  return {
    username: fileConfig.username,
    password: fileConfig.password,
    source: 'file'
  };
}

function verifyAdminCredentials(credentials, username, password) {
  return safeCompare(credentials.username, username) &&
    safeCompare(credentials.password, password);
}

module.exports = {
  AUTH_FILE,
  loadAdminCredentials,
  verifyAdminCredentials
};
