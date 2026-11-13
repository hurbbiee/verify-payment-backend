const { validateImage } = require("../middlewares/upload.middleware");
const { verifySlip, getProviderUsage } = require("./slip.service");
const { formatResult } = require("../utils/telegram-result");
const fail = (text) => Object.assign(new Error(text), { safe: true });
async function telegramCall(token, method, body) {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    },
  );
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error("Telegram request failed");
  return result.result;
}
async function inspectMessage(message, token, provider = "thunder") {
  const attachment = message.photo?.at(-1) ?? message.document;
  if (!attachment?.file_id)
    return "กรุณาส่งรูปสลิป JPEG PNG หรือ WebP ขนาดไม่เกิน 4 MB";
  if (attachment.file_size > 4 * 1024 * 1024)
    throw fail("รูปต้องมีขนาดไม่เกิน 4 MB");
  const metadata = await telegramCall(token, "getFile", {
    file_id: attachment.file_id,
  });
  if (metadata.file_size > 4 * 1024 * 1024)
    throw fail("รูปต้องมีขนาดไม่เกิน 4 MB");
  if (
    !metadata.file_path ||
    !/^[a-zA-Z0-9_./-]+$/.test(metadata.file_path) ||
    metadata.file_path.includes("..")
  )
    throw new Error("Invalid Telegram file path");
  const response = await fetch(
    `https://api.telegram.org/file/bot${token}/${metadata.file_path}`,
    { signal: AbortSignal.timeout(15000), redirect: "error" },
  );
  if (!response.ok || !response.body) throw new Error("Download failed");
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 4 * 1024 * 1024) {
      await response.body.cancel().catch(() => {});
      throw fail("รูปต้องมีขนาดไม่เกิน 4 MB");
    }
    chunks.push(chunk);
  }
  const req = { file: { buffer: Buffer.concat(chunks) } };
  await new Promise((resolve, reject) =>
    validateImage(req, {}, (error) => (error ? reject(error) : resolve())),
  );
  const result = await verifySlip(req.file, provider);
  const usage = await getProviderUsage(provider, result.keyLabel);
  const keyLine = result.keyLabel ? `\nใช้ ${result.keyLabel}` : "";
  return `${usage.name}\n${formatResult(result)}\n\n${formatUsage(usage)}${keyLine}`;
}

function formatUsage(usage) {
  if (usage.status !== "ok") {
    return `${usage.name}: ${usage.status === "not_configured" ? "ยังไม่ได้ตั้งค่า" : "ดึงโควตาไม่ได้"}`;
  }
  const quota = usage.provider === "slip2go"
    ? `เหลือ ${usage.tokenRemaining} โทเคน${usage.estimatedSlips == null ? "" : ` (~${usage.estimatedSlips} สลิป)`}`
    : `ใช้ ${usage.used} / ${usage.max ?? "ไม่จำกัด"} ครั้ง`;
  const expiry = usage.expiresAt
    ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(usage.expiresAt))
    : "ไม่ระบุ";
  return `${usage.name}: ${quota} · หมดอายุ ${expiry}`;
}

module.exports = { telegramCall, inspectMessage, formatUsage };
