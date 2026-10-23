const express = require("express");
const { timingSafeEqual } = require("node:crypto");
const router = express.Router();
function matches(actual, expected) {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
router.post("/webhook", async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !secret) return res.sendStatus(503);
  if (!matches(req.get("X-Telegram-Bot-Api-Secret-Token"), secret))
    return res.sendStatus(403);
  const message = req.body?.message;
  if (
    !message ||
    message.chat?.type !== "private" ||
    !Number.isSafeInteger(message.from?.id)
  )
    return res.sendStatus(200);
  let text;
  const command = message.text?.split(/\s/)[0]?.split("@")[0];
  if (command === "/id")
    text = `Telegram user ID ของคุณ: ${message.from.id}\nนำค่านี้ไปตั้ง TELEGRAM_ALLOWED_USER_IDS ใน backend`;
  else if (command === "/start")
    text =
      "เชื่อมต่อ SlipCheck แล้วครับ ใช้ /id เพื่อดู user ID ของคุณ ขั้นตอนนี้ยังไม่เปิดตรวจรูปสลิป";
  else {
    const allowed = (process.env.TELEGRAM_ALLOWED_USER_IDS ?? "")
      .split(",")
      .map((x) => x.trim());
    if (!allowed.includes(String(message.from.id))) return res.sendStatus(200);
    text =
      "รับข้อความแล้วครับ ตอนนี้อยู่ขั้นทดสอบ webhook ยังไม่ได้เปิดตรวจสลิปผ่าน Telegram";
  }
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: message.chat.id, text }),
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      },
    );
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error("Telegram reply failed");
    res.sendStatus(200);
  } catch {
    res.sendStatus(502);
  }
});
module.exports = { router, matches };
