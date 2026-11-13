async function getUsage({
  apiKey = process.env.THUNDER_API_KEY,
  fetchImpl = fetch,
  endpoint = "https://api.thunder.in.th/v2/info",
  detailed = false,
  keyName = "THUNDER_API_KEY",
} = {}) {
  const fail = (status, code, message) =>
    Object.assign(new Error(message), { status, code, safe: true });
  if (!apiKey?.trim())
    throw fail(
      503,
      "VERIFICATION_NOT_CONFIGURED",
      `กรุณาตั้ง ${keyName}`,
    );
  let response, body;
  try {
    response = await fetchImpl(endpoint, {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    body = await response.json();
  } catch {
    throw fail(502, "USAGE_UNAVAILABLE", "ดึงจำนวนการใช้งานไม่ได้");
  }
  const quota = body?.data?.application?.quota;
  if (
    !response.ok ||
    body?.success !== true ||
    !quota ||
    !Number.isInteger(quota.used) ||
    quota.used < 0 ||
    !(quota.max === null || (Number.isInteger(quota.max) && quota.max >= 0))
  ) {
    throw fail(502, "USAGE_UNAVAILABLE", "ดึงจำนวนการใช้งานไม่ได้");
  }
  // Return quota only; do not expose account email, credit or other account details.
  const result = { used: quota.used, max: quota.max };
  if (!detailed) return result;
  const expiresAt = body.data.application.autoRenew?.expiresAt;
  return {
    ...result,
    remaining: quota.max === null ? null : Math.max(0, quota.max - quota.used),
    expiresAt: typeof expiresAt === "string" && Number.isFinite(Date.parse(expiresAt)) ? expiresAt : null,
  };
}
module.exports = { getUsage };
