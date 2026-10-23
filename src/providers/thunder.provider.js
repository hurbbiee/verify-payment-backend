function failure(status, code, message) {
  return Object.assign(new Error(message), { status, code, safe: true });
}
const text = (value) =>
  typeof value === "string" && value.length ? value : null;
const number = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const party = (value) => ({
  bank: text(value?.bank?.name) ?? text(value?.bank?.short),
  name: text(value?.account?.name?.th) ?? text(value?.account?.name?.en),
  account:
    text(value?.account?.bank?.account) ?? text(value?.account?.proxy?.account),
});

async function verify(
  file,
  {
    apiKey = process.env.THUNDER_API_KEY,
    fetchImpl = fetch,
    timeoutMs = 20000,
  } = {},
) {
  if (!apiKey?.trim())
    throw failure(
      503,
      "VERIFICATION_NOT_CONFIGURED",
      "กรุณาตั้ง THUNDER_API_KEY ใน backend/.env",
    );
  const body = new FormData();
  body.append(
    "image",
    new Blob([file.buffer], { type: file.detectedMime }),
    "slip",
  );
  body.append("checkDuplicate", "true");
  let response, result;
  try {
    response = await fetchImpl("https://api.thunder.in.th/v2/verify/bank", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    result = await response.json();
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError")
      throw failure(504, "PROVIDER_TIMEOUT", "บริการตรวจสลิปตอบกลับไม่ทันเวลา");
    throw failure(
      502,
      "PROVIDER_UNAVAILABLE",
      "ไม่สามารถติดต่อบริการตรวจสลิปได้",
    );
  }
  if (!response.ok || result?.success !== true) {
    const code = result?.error?.code;
    if (response.status === 401)
      throw failure(
        502,
        "PROVIDER_AUTH_ERROR",
        "API key ของบริการตรวจสลิปไม่ถูกต้อง",
      );
    if (code === "QUOTA_EXCEEDED")
      throw failure(503, "PROVIDER_QUOTA_EXCEEDED", "โควต้าบริการตรวจสลิปหมด");
    if (response.status === 429)
      throw failure(
        503,
        "PROVIDER_RATE_LIMITED",
        "บริการตรวจสลิปมีคำขอมาก กรุณาลองใหม่ภายหลัง",
      );
    if (
      ["SLIP_NOT_FOUND", "QR_CODE_NOT_FOUND", "INVALID_IMAGE_FORMAT"].includes(
        code,
      )
    )
      throw failure(
        422,
        "SLIP_UNVERIFIED",
        "ไม่สามารถยืนยันสลิปนี้ได้ กรุณาใช้รูปสลิปที่เห็น QR ชัดเจน",
      );
    throw failure(
      502,
      "PROVIDER_ERROR",
      "บริการตรวจสลิปไม่สามารถประมวลผลคำขอได้",
    );
  }
  const data = result.data;
  const raw = data?.rawSlip;
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    typeof data.isDuplicate !== "boolean"
  )
    throw failure(
      502,
      "INVALID_PROVIDER_RESPONSE",
      "รูปแบบผลตอบกลับจากบริการตรวจสลิปไม่ถูกต้อง",
    );
  return {
    success: true,
    status: data.isDuplicate ? "DUPLICATE" : "VERIFIED",
    data: {
      transactionRef: text(raw.transRef),
      sender: party(raw.sender),
      receiver: party(raw.receiver),
      amount: number(raw.amount?.amount),
      currency: text(raw.amount?.local?.currency),
      transferDateTime: text(raw.date),
    },
  };
}
module.exports = { verify };
