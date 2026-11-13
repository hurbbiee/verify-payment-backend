const { test } = require("node:test");
const assert = require("node:assert/strict");
const easy = require("../src/providers/easyslip.provider");
const slip2go = require("../src/providers/slip2go.provider");
const file = { buffer: Buffer.from("mock"), detectedMime: "image/png" };

test("EasySlip switches keys only on quota or package errors and reads the used key's quota", async t => {
  const previous = process.env.EASYSLIP_API_KEYS;
  process.env.EASYSLIP_API_KEYS = '["first-secret","second-secret"]';
  t.after(() => {
    if (previous === undefined) delete process.env.EASYSLIP_API_KEYS;
    else process.env.EASYSLIP_API_KEYS = previous;
  });
  const calls = [];
  const result = await easy.verify(file, {
    fetchImpl: async (url, init) => {
      calls.push(init.headers.Authorization);
      if (calls.length === 1)
        return Response.json({ success: false, error: { code: "QUOTA_EXCEEDED" } }, { status: 403 });
      return Response.json({ success: true, data: { isDuplicate: true, rawSlip: {} } });
    },
  });
  assert.deepEqual(calls, ["Bearer first-secret", "Bearer second-secret"]);
  assert.equal(result.keyLabel, "key2");
  assert.equal(result.status, "DUPLICATE");
  assert.doesNotMatch(JSON.stringify(result), /secret/);
  await easy.getUsage({
    keyLabel: result.keyLabel,
    fetchImpl: async (url, init) => {
      assert.equal(init.headers.Authorization, "Bearer second-secret");
      return Response.json({ success: true, data: { application: { quota: { used: 2, max: 10 } } } });
    },
  });
  let attempts = 0;
  await assert.rejects(easy.verify(file, {
    fetchImpl: async () => {
      attempts += 1;
      return Response.json({ success: false, error: { code: "SLIP_NOT_FOUND" } }, { status: 404 });
    },
  }), { code: "SLIP_UNVERIFIED" });
  assert.equal(attempts, 1);
});

test("EasySlip sends the bank image and normalizes the Thunder-style result", async () => {
  const result = await easy.verify(file, {
    apiKey: "easy-test",
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://api.easyslip.com/v2/verify/bank");
      assert.equal(init.headers.Authorization, "Bearer easy-test");
      assert.equal(init.body.get("image").type, "image/png");
      assert.equal(init.body.get("checkDuplicate"), "true");
      return Response.json({ success: true, data: {
        isDuplicate: false, rawSlip: { transRef: "TX", amount: { amount: 100 } },
      } });
    },
  });
  assert.equal(result.status, "VERIFIED");
  assert.equal(result.data.transactionRef, "TX");
});

test("Slip2Go reads application codes even when HTTP status is 200", async () => {
  const verify = (code, data) => slip2go.verify(file, {
    apiKey: "slip-test",
    baseUrl: "https://example.test",
    fetchImpl: async (url, init) => {
      assert.equal(url.pathname, "/api/verify-slip/qr-image/info");
      assert.equal(init.body.get("file").name, "slip.png");
      assert.deepEqual(JSON.parse(init.body.get("payload")), { checkDuplicate: true });
      return Response.json({ code, data });
    },
  });
  const result = await verify("200501", { transRef: "TX", referenceId: "HISTORY", amount: 10 });
  assert.equal(result.status, "DUPLICATE");
  assert.equal(result.data.transactionRef, "TX");
  await assert.rejects(verify("200402"), { code: "SLIP_UNVERIFIED" });
  await assert.rejects(verify("401005"), { code: "PROVIDER_QUOTA_EXCEEDED" });
});

test("usage preserves token units and expiry", async () => {
  const expiresAt = "2026-12-01T00:00:00Z";
  const result = await slip2go.getUsage({
    apiKey: "test", baseUrl: "https://example.test",
    fetchImpl: async (url, init) => {
      assert.equal(url.pathname, "/api/account/info");
      assert.equal(init.method, "GET");
      return Response.json({ code: "200001", data: {
        tokenRemaining: 0, estimatedQuotaSlip: 0, packageExpiredDate: expiresAt,
      } });
    },
  });
  assert.deepEqual(result, { tokenRemaining: 0, estimatedSlips: 0, expiresAt });
});

test("combined usage returns partial results when a provider fails or is unconfigured", async t => {
  const env = {
    THUNDER_API_KEY: "thunder-test",
    EASYSLIP_API_KEY: "easy-test",
    EASYSLIP_API_KEYS: "",
    SLIP2GO_API_SECRET: "",
  };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  t.mock.method(globalThis, "fetch", async url => {
    if (url === "https://api.easyslip.com/v2/info") throw new Error("simulated outage");
    assert.equal(url, "https://api.thunder.in.th/v2/info");
    return Response.json({ success: true, data: { application: { quota: { used: 2, max: 10 } } } });
  });
  const { getAllUsage } = require("../src/services/slip.service");
  assert.deepEqual(await getAllUsage(), [
    { provider: "thunder", name: "Thunder", status: "ok", used: 2, max: 10, remaining: 8, expiresAt: null },
    { provider: "easyslip", name: "EasySlip", status: "unavailable" },
    { provider: "slip2go", name: "Slip2Go", status: "not_configured" },
  ]);
});
