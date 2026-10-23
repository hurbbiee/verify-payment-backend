const { test } = require("node:test");
const assert = require("node:assert/strict");
const { formatResult } = require("../src/utils/telegram-result");
test("Telegram formats verified amount and real quota with zero preserved", () => {
  const text = formatResult(
    {
      status: "VERIFIED",
      data: {
        amount: 50,
        currency: "764",
        sender: { name: "ทดสอบ" },
        receiver: {},
        transferDateTime: "2026-10-23T15:00:00+07:00",
        transactionRef: "TEST",
      },
    },
    { used: 0, max: 100 },
  );
  assert.match(text, /50.00 บาท/);
  assert.match(text, /0 \/ 100/);
  assert.match(text, /ตรวจสอบพบธุรกรรม/);
  assert.match(text, /ไม่มีข้อมูล/);
});
test("Telegram duplicate and quota outage are explicit", () => {
  const text = formatResult({ status: "DUPLICATE", data: {} }, null);
  assert.match(text, /ตรวจสลิปซ้ำ/);
  assert.match(text, /ดึงข้อมูลไม่ได้/);
});
