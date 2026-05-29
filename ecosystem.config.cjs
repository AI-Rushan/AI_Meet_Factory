module.exports = {
  apps: [
    {
      name: "api",
      script: "dist/index.js",
      cwd: "./apps/backend",
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "worker",
      script: "dist/worker.js",
      cwd: "./apps/backend",
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
