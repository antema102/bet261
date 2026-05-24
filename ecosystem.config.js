module.exports = {
  apps: [
    {
      name: 'bet-261-back',
      cwd: './backend',
      script: 'dist/server.js',
      interpreter: 'node',
      interpreter_args: '--max-old-space-size=512',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '600M',   // pm2 redémarre si >600 Mo
      restart_delay: 3000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
