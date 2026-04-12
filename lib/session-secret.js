const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SECRET_FILE = path.join(__dirname, '../data/session-secret.txt');

function writeSessionSecret(secret) {
  fs.writeFileSync(SECRET_FILE, `${secret}\n`, {
    encoding: 'utf8',
    mode: 0o600
  });
}

function loadSessionSecret() {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }

  if (fs.existsSync(SECRET_FILE)) {
    const secret = fs.readFileSync(SECRET_FILE, 'utf8').trim();
    if (secret) return secret;
  }

  const secret = crypto.randomBytes(32).toString('hex');
  writeSessionSecret(secret);
  console.warn('[session] Created local session secret at:', SECRET_FILE);
  return secret;
}

module.exports = {
  SECRET_FILE,
  loadSessionSecret
};
