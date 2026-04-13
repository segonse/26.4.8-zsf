module.exports = {
  apps: [
    {
      name: 'product-credential-site',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        PORT: 18081,
        COOKIE_SECURE: 'true',
        APP_STORAGE_ROOT: '/srv/data/info.c.bimumedia.com'
      }
    }
  ]
};
