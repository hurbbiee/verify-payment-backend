const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verify } = require('../src/providers/thunder.provider');
const file = { buffer: Buffer.from('test'), detectedMime: 'image/png' };
test('normalizes real response and sends image and duplicate flag', async () => {
  const result = await verify(file, { apiKey: 'test', fetchImpl: async (url, init) => {
    assert.equal(init.body.get('checkDuplicate'), 'true');
    assert.ok(init.body.get('image'));
    assert.equal(init.headers.Authorization, 'Bearer test');
    return Response.json({ success: true, data: { isDuplicate: true, rawSlip: { transRef: 'ref', date: '2026-10-23T10:30:00+07:00', amount: { amount: 0 } } } });
  } });
  assert.equal(result.status, 'DUPLICATE');
  assert.equal(result.data.amount, 0);
  assert.equal(result.data.currency, null);
  assert.equal(result.data.sender.name, null);
  assert.equal(result.data.transferDateTime, '2026-10-23T10:30:00+07:00');
});
test('normalizes missing credentials, timeout, outage, invalid response and slip errors', async () => {
  await assert.rejects(verify(file, { apiKey: '' }), { code: 'VERIFICATION_NOT_CONFIGURED' });
  for (const [name, code] of [['TimeoutError', 'PROVIDER_TIMEOUT'], ['TypeError', 'PROVIDER_UNAVAILABLE']]) {
    await assert.rejects(verify(file, { apiKey: 'test', fetchImpl: async () => { throw Object.assign(new Error(), { name }); } }), { code });
  }
  for (const [body, status, code] of [[{}, 200, 'PROVIDER_ERROR'], [{success:true,data:{}},200,'INVALID_PROVIDER_RESPONSE'], [{success:false,error:{code:'SLIP_NOT_FOUND'}},404,'SLIP_UNVERIFIED'], [{},401,'PROVIDER_AUTH_ERROR']]) {
    await assert.rejects(verify(file, { apiKey:'test', fetchImpl:async()=>Response.json(body,{status}) }), {code});
  }
});
