module.exports = {
  apps: [
    {
      name: "bni-platform",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      log_file: "/var/log/bni/combined.log",
      error_file: "/var/log/bni/error.log",
      time: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
