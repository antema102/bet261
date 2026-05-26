module.exports = {
  apps: [
    {
      name: 'bet-261-back',
      cwd: './backend',
      script: 'dist/server.js',
      interpreter: 'node',
      interpreter_args: '--max-old-space-size=300 --optimize-for-size --gc-interval=100',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '400M',   // pm2 redémarre si >400 Mo
      restart_delay: 3000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
