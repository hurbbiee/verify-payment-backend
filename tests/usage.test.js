const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getUsage } = require('../src/providers/thunder-usage.provider');
test('returns quota only and preserves zero and unlimited', async () => {
  const result = await getUsage({ apiKey: 'test', fetchImpl: async () => Response.json({ success: true, data: { application: { quota: { used: 0, max: null } }, account: { email: 'private' } } }) });
  assert.deepEqual(result, { used: 0, max: null });
});
test('usage missing key and provider failure are explicit', async () => {
  await assert.rejects(getUsage({ apiKey: '' }), { code: 'VERIFICATION_NOT_CONFIGURED' });
  await assert.rejects(getUsage({ apiKey: 'test', fetchImpl: async () => Response.json({success:false}, {status:401}) }), { code: 'USAGE_UNAVAILABLE' });
});
