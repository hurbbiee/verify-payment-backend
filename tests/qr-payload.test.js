const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inspectPayload } = require('../src/utils/qr-payload');
test('splits synthetic TLV without inventing meanings', () => {
  const result = inspectPayload('0003abc010212');
  assert.equal(result.format, 'TLV_CANDIDATE');
  assert.deepEqual(result.fields, [{ id: '00', length: 3, value: 'abc' }, { id: '01', length: 2, value: '12' }]);
});
test('unknown and truncated payloads do not produce guessed fields', () => {
  for (const payload of ['https://example.com', '0009abc', '0003abcBAD']) {
    assert.equal(inspectPayload(payload).format, 'UNKNOWN');
    assert.deepEqual(inspectPayload(payload).fields, []);
  }
});
const { decodeMiniQr, crc16 } = require('../src/utils/qr-payload');
test('decodes documented Mini QR with synthetic data and verifies CRC', () => {
  assert.equal(crc16('123456789'), '29B1');
  const nested = '000600000101030140206TEST01';
  const prefix = '00' + String(nested.length).padStart(2,'0') + nested + '5102TH9104';
  const result = decodeMiniQr(prefix + crc16(prefix));
  assert.equal(result.sendingBankCode, '014');
  assert.equal(result.transactionRef, 'TEST01');
  assert.equal(result.checksum.valid, true);
  assert.equal(result.amount, null);
  assert.equal(decodeMiniQr(prefix + '0000').checksum.valid, false);
  assert.equal(decodeMiniQr('0003abc'), null);
});
