require('dotenv').config({ quiet: true });
const { readEnv } = require('./config/env');
const { createApp } = require('./app');

const config = readEnv();
const server = createApp(config).listen(config.port, () => {
  console.log(`API listening on port ${config.port}`);
});
server.on('error', () => {
  console.error('Unable to start HTTP server');
  process.exitCode = 1;
});
