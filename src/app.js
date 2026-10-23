const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const { readEnv } = require('./config/env');
const { notFound, errorHandler } = require('./middlewares/error.middleware');

function createApp(config = readEnv()) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '16kb' }));
  app.use('/api/telegram', require('./routes/telegram.routes').router);
  app.use('/api', routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
