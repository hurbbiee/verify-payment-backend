function notFound(req, res) {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
}

// Express recognizes an error middleware by its four parameters.
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err.safe === true) {
    return res.status(err.status).json({ success: false, error: { code: err.code, message: err.message } });
  }
  const invalidJson = err.type === 'entity.parse.failed';
  const tooLarge = err.type === 'entity.too.large';
  const status = invalidJson ? 400 : tooLarge ? 413 : 500;
  const code = invalidJson ? 'INVALID_JSON' : tooLarge ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR';
  const message = invalidJson ? 'Invalid JSON body' : tooLarge ? 'Request body is too large' : 'Unexpected server error';
  res.status(status).json({ success: false, error: { code, message } });
}

module.exports = { notFound, errorHandler };
