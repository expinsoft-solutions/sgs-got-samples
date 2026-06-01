const NODE_BIN = '/home/remote/.nvm/versions/node/v23.11.1/bin';

module.exports = {
  apps: [
    {
      name: 'sgs-web',
      cwd: './web',
      script: `${NODE_BIN}/npm`,
      args: 'run start',
      env: {
        NODE_ENV: 'production',
        PORT: 6626,
        PATH: `${NODE_BIN}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
      },
    },
    {
      name: 'sgs-api',
      cwd: './api',
      script: `${NODE_BIN}/node`,
      args: 'dist/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 7626,
        PATH: `${NODE_BIN}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
      },
    },
  ],
};
