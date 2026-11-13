function failure(status, code, message) {
  return Object.assign(new Error(message), { status, code, safe: true });
}

async function request(path, body, {
  apiKey = process.env.SLIP2GO_API_SECRET,
  baseUrl = process.env.SLIP2GO_BASE_URL,
  fetchImpl = fetch,
} = {}) {
  if (!apiKey?.trim() || !baseUrl?.trim())
    throw failure(503, "VERIFICATION_NOT_CONFIGURED", "กรุณาตั้ง SLIP2GO_API_SECRET และ SLIP2GO_BASE_URL");
  let url;
  try {
    url = new URL(baseUrl);
    if (url.protocol !== "https:" || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash) throw new Error();
  } catch {
    throw failure(503, "VERIFICATION_NOT_CONFIGURED", "SLIP2GO_BASE_URL ต้องเป็น HTTPS origin ของ Slip2Go");
  }
  let response;
  try {
    response = await fetchImpl(new URL(path, url), {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(body ? 20000 : 10000),
    });
    if (response.status === 429)
      throw failure(503, "PROVIDER_RATE_LIMITED", "Slip2Go ถูกจำกัดจำนวนคำขอชั่วคราว");
    return { ok: response.ok, result: await response.json() };
  } catch (error) {
    if (error.safe) throw error;
    if (error.name === "TimeoutError" || error.name === "AbortError")
      throw failure(504, "PROVIDER_TIMEOUT", "Slip2Go ตอบกลับไม่ทันเวลา");
    throw failure(502, "PROVIDER_UNAVAILABLE", "ติดต่อ Slip2Go ไม่สำเร็จ");
  }
}

const text = value => typeof value === "string" && value.length ? value : null;
const number = value => Number.isFinite(value) && value >= 0 ? value : null;
const party = value => ({
  bank: text(value?.bank?.name) ?? text(value?.bank?.id),
  name: text(value?.account?.name),
  account: text(value?.account?.bank?.account) ?? text(value?.account?.proxy?.account),
});

async function verify(file, options) {
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.detectedMime];
  const body = new FormData();
  body.append("file", new Blob([file.buffer], { type: file.detectedMime }), `slip.${extension}`);
  body.append("payload", JSON.stringify({ checkDuplicate: true }));
  const { ok, result } = await request("/api/verify-slip/qr-image/info", body, options);
  const code = result?.code;
  if (["401005", "401006"].includes(code))
    throw failure(503, "PROVIDER_QUOTA_EXCEEDED", "โทเคนหรือเครดิต Slip2Go ไม่เพียงพอ");
  if (code === "401004")
    throw failure(503, "PROVIDER_PACKAGE_EXPIRED", "แพ็กเกจ Slip2Go หมดอายุ");
  if (code === "429000")
    throw failure(503, "PROVIDER_RATE_LIMITED", "Slip2Go ถูกจำกัดจำนวนคำขอชั่วคราว");
  if (["200401", "200402", "200403", "200404", "200500", "400001"].includes(code))
    throw failure(422, "SLIP_UNVERIFIED", "Slip2Go ตรวจยืนยันสลิปนี้ไม่สำเร็จ");
  if (!ok || !["200000", "200200", "200501"].includes(code))
    throw failure(502, "PROVIDER_ERROR", "Slip2Go ประมวลผลคำขอไม่สำเร็จ");
  const data = result.data;
  if (!text(data?.transRef) || number(data?.amount) === null)
    throw failure(502, "INVALID_PROVIDER_RESPONSE", "ข้อมูลธุรกรรมจาก Slip2Go ไม่ครบ");
  return {
    success: true,
    status: code === "200501" ? "DUPLICATE" : "VERIFIED",
    data: {
      transactionRef: data.transRef,
      sender: party(data.sender),
      receiver: party(data.receiver),
      amount: data.amount,
      currency: null,
      transferDateTime: text(data.dateTime),
    },
  };
}

async function getUsage(options) {
  const { ok, result } = await request("/api/account/info", undefined, options);
  const data = result?.data;
  const tokenRemaining = number(data?.tokenRemaining);
  if (!ok || result?.code !== "200001" || tokenRemaining === null)
    throw failure(502, "USAGE_UNAVAILABLE", "ดึงโควตา Slip2Go ไม่สำเร็จ");
  return {
    tokenRemaining,
    estimatedSlips: number(data.estimatedQuotaSlip),
    expiresAt: Number.isFinite(Date.parse(data.packageExpiredDate)) ? data.packageExpiredDate : null,
  };
}

module.exports = { verify, getUsage };
