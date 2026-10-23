function readEnv(source = process.env) {
  const port = Number(source.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const nodeEnv = source.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }
  const corsOrigin = source.CORS_ORIGIN ?? 'http://localhost:4200';
  let url;
  try { url = new URL(corsOrigin); } catch {
    throw new Error('CORS_ORIGIN must be a valid HTTP origin');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== corsOrigin) {
    throw new Error('CORS_ORIGIN must be a valid HTTP origin without a path');
  }
  return { port, nodeEnv, corsOrigin };
}

module.exports = { readEnv };
