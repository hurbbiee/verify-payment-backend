const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { readEnv } = require('../src/config/env');

async function withServer(run) {
  const server = createApp(readEnv({ NODE_ENV: 'test' })).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('health returns server status and security headers', () => withServer(async base => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { success: true, message: 'API is running' });
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
}));
test('unknown route returns consistent JSON', () => withServer(async base => {
  const res = await fetch(`${base}/missing`);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, 'NOT_FOUND');
}));
test('malformed JSON is rejected safely', () => withServer(async base => {
  const res = await fetch(`${base}/api/health`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken',
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVALID_JSON');
}));
test('invalid environment values fail early', () => {
  assert.throws(() => readEnv({ PORT: 'oops' }), /PORT/);
  assert.throws(() => readEnv({ NODE_ENV: 'invalid' }), /NODE_ENV/);
  assert.throws(() => readEnv({ CORS_ORIGIN: '*' }), /CORS_ORIGIN/);
});

test('upload validation and unconfigured verification', () => withServer(async base => {
  const send = async (blob, field = 'slip') => {
    const body = new FormData();
    if (blob) body.append(field, blob, 'image.png');
    return fetch(`${base}/api/slips/verify`, { method: 'POST', body });
  };
  let res = await send(null);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'MISSING_FILE');
  res = await send(new Blob(['not an image'], { type: 'image/png' }));
  assert.equal(res.status, 415);
  res = await send(new Blob([new Uint8Array(4 * 1024 * 1024 + 1)]));
  assert.equal(res.status, 413);
  res = await send(new Blob(['x']), 'wrong');
  assert.equal(res.status, 400);
  const sharp = require('sharp');
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'white' } }).png().toBuffer();
  res = await send(new Blob([png], { type: 'application/octet-stream' }));
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error.code, 'VERIFICATION_NOT_CONFIGURED');
  res = await send(new Blob([png.subarray(0, 40)]));
  assert.equal(res.status, 422);
}));

test('read QR returns raw payload without claiming verification', () => withServer(async base => {
  const qrcode = require('qrcode');
  const png = await qrcode.toBuffer('TEST-ONLY-1234567890', { width: 400 });
  const body = new FormData();
  body.append('slip', new Blob([png], { type: 'image/png' }), 'qr.png');
  const res = await fetch(`${base}/api/slips/read-qr`, { method: 'POST', body });
  assert.equal(res.status, 200);
  const result = await res.json();
  assert.equal(result.verified, false);
  assert.equal(result.data.payload, 'TEST-ONLY-1234567890');
}));
