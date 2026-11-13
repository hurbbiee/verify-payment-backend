const thunder = require("../providers/thunder.provider");
const thunderUsage = require("../providers/thunder-usage.provider");
const providers = new Map([
  ["thunder", { name: "Thunder", verify: thunder.verify, getUsage: () => thunderUsage.getUsage({ detailed: true }) }],
  ["easyslip", { name: "EasySlip", ...require("../providers/easyslip.provider") }],
  ["slip2go", { name: "Slip2Go", ...require("../providers/slip2go.provider") }],
]);

async function verifySlip(file, provider = "thunder") {
  const selected = providers.get(provider);
  if (!selected) {
    throw Object.assign(new Error("กรุณาเลือก thunder, easyslip หรือ slip2go"), {
      status: 400, code: "INVALID_PROVIDER", safe: true,
    });
  }
  return selected.verify(file);
}

async function getProviderUsage(provider, keyLabel) {
  const selected = providers.get(provider);
  const identity = { provider, name: selected.name };
  try {
    return { ...identity, status: "ok", ...await selected.getUsage({ keyLabel }) };
  } catch (error) {
    return {
      ...identity,
      status: error.code === "VERIFICATION_NOT_CONFIGURED" ? "not_configured" : "unavailable",
    };
  }
}

function getAllUsage() {
  return Promise.all([...providers.keys()].map(provider => getProviderUsage(provider)));
}

module.exports = { verifySlip, getProviderUsage, getAllUsage };
