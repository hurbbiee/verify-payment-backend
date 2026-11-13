// EasySlip and Thunder v2 share the multipart and rawSlip contracts.
const bank = require("./thunder.provider");
const usage = require("./thunder-usage.provider");

function configuredKeys() {
  const value = process.env.EASYSLIP_API_KEYS?.trim();
  if (!value) {
    const legacyKey = process.env.EASYSLIP_API_KEY?.trim();
    return legacyKey ? [legacyKey] : [];
  }
  try {
    const keys = JSON.parse(value);
    if (Array.isArray(keys) && keys.length && keys.every(key => typeof key === "string" && key.trim())) {
      const trimmed = keys.map(key => key.trim());
      if (new Set(trimmed).size === trimmed.length) return trimmed;
    }
  } catch {
    // Keep credentials and parser details out of error responses.
  }
  throw Object.assign(new Error('EASYSLIP_API_KEYS ต้องเป็น JSON array ของคีย์ที่ไม่ซ้ำกัน'), {
    status: 503, code: "VERIFICATION_NOT_CONFIGURED", safe: true,
  });
}

async function verify(file, { apiKey, fetchImpl } = {}) {
  const keys = apiKey === undefined ? configuredKeys() : [apiKey];
  for (const [index, key] of (keys.length ? keys : [""]).entries()) {
    try {
      const result = await bank.verify(file, {
        apiKey: key, fetchImpl,
        keyName: "EASYSLIP_API_KEYS",
        endpoint: "https://api.easyslip.com/v2/verify/bank",
      });
      return { ...result, keyLabel: `key${index + 1}` };
    } catch (error) {
      const canSwitch = ["PROVIDER_QUOTA_EXCEEDED", "PROVIDER_PACKAGE_EXPIRED"].includes(error.code);
      if (!canSwitch || index + 1 >= keys.length) throw error;
    }
  }
}

function getUsage({ apiKey, fetchImpl, keyLabel = "key1" } = {}) {
  const index = Number(keyLabel.slice(3)) - 1;
  return usage.getUsage({
    apiKey: apiKey ?? configuredKeys()[index] ?? "", fetchImpl,
    endpoint: "https://api.easyslip.com/v2/info",
    detailed: true,
    keyName: "EASYSLIP_API_KEYS",
  });
}

module.exports = { verify, getUsage };
