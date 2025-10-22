module.exports = {
  apps: [
    {
      name: 'ta-cukrarna',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/ta-cukrarna/current',
      user: 'ta-cukrarna',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: '/var/www/ta-cukrarna/logs/error.log',
      out_file: '/var/www/ta-cukrarna/logs/out.log',
      log_file: '/var/www/ta-cukrarna/logs/combined.log',
      time: true,
    },
  ],
};
