module.exports = {
  apps: [
    {
      name: 'freightdesk-api',
      script: 'server.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '5s',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
