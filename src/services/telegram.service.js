const { validateImage } = require("../middlewares/upload.middleware");
const { verifySlip } = require("./slip.service");
const { getUsage } = require("../providers/thunder-usage.provider");
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
async function inspectMessage(message, token) {
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
  const result = await verifySlip(req.file);
  const usage = await getUsage().catch(() => null);
  return formatResult(result, usage);
}
module.exports = { telegramCall, inspectMessage };
