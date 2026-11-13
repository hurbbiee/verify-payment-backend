const express = require("express");
const { timingSafeEqual } = require("node:crypto");
const {
  telegramCall,
  inspectMessage,
  formatUsage,
} = require("../services/telegram.service");
const { getAllUsage } = require("../services/slip.service");
const { groupPolicy } = require("../utils/telegram-policy");
const verifyCommands = new Map([
  ["/v", "thunder"],
  ["/ve", "easyslip"],
  ["/vs", "slip2go"],
]);
const router = express.Router();
const processed = new Map();
const busy = new Set();
function matches(actual, expected) {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
router.post("/webhook", async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !process.env.TELEGRAM_WEBHOOK_SECRET)
    return res.sendStatus(503);
  if (
    !matches(
      req.get("X-Telegram-Bot-Api-Secret-Token"),
      process.env.TELEGRAM_WEBHOOK_SECRET,
    )
  )
    return res.sendStatus(403);
  const m = req.body?.message;
  const updateId = req.body?.update_id;
  if (
    !m ||
    !["private", "group", "supergroup"].includes(m.chat?.type) ||
    !Number.isSafeInteger(m.from?.id) ||
    !Number.isSafeInteger(updateId)
  )
    return res.sendStatus(200);
  const now = Date.now();
  for (const [id, time] of processed)
    if (now - time > 86400000) processed.delete(id);
  if (processed.has(updateId)) return res.sendStatus(200);
  if (processed.size >= 10000) return res.sendStatus(503);
  processed.set(updateId, now);
  const { group, command, canVerify: allowed, allowedChat } = groupPolicy(m);
  const provider = verifyCommands.get(command);
  const hasCommand = (m.text ?? m.caption ?? "").startsWith("/");
  if (group && !provider && !["/id", "/chatid", "/start", "/q"].includes(command)) return res.sendStatus(200);
  if (!group && hasCommand && !command) return res.sendStatus(200);
  if (group && command !== '/chatid' && !allowedChat) return res.sendStatus(200);
  let text;
  let locked = false;
  try {
    if (command === "/chatid") text = `Chat ID: ${m.chat.id}`;
    else if (command === "/id") text = `Telegram user ID ของคุณ: ${m.from.id}`;
    else if (command === "/start")
      text = "SlipCheck\n/v Thunder · /ve EasySlip · /vs Slip2Go\nแนบรูปหรือ reply รูปด้วยคำสั่งที่เลือก\n/q ดูโควตาทุกเจ้า · /id ดู Telegram ID";
    else if (!allowed)
      text = "บัญชีนี้ยังไม่ได้รับสิทธิ์ตรวจสลิป ส่ง /id แล้วติดต่อเจ้าของ bot";
    else if (command === "/q") text = (await getAllUsage()).map(formatUsage).join("\n");
    else if (hasCommand && !provider) text = "ใช้ /v, /ve หรือ /vs เพื่อตรวจสลิป หรือ /q เพื่อดูโควตา";
    else if (busy.has(m.from.id)) text = "กำลังตรวจรูปก่อนหน้า กรุณารอสักครู่";
    else {
      busy.add(m.from.id);
      locked = true;
      try {
        const source = !m.photo && !m.document && provider ? m.reply_to_message : m;
        text = await inspectMessage(source ?? {}, token, provider);
      } catch (error) {
        text = error.safe
          ? `⚠️ ${error.message}`
          : "⚠️ ไม่สามารถประมวลผลสลิปได้ กรุณาลองใหม่ภายหลัง";
      }
    }
    await telegramCall(token, "sendMessage", {
      chat_id: m.chat.id,
      text: text.slice(0, 4000),
      ...(group && Number.isSafeInteger(m.message_id) ? { reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true } } : {}),
      ...(m.message_thread_id ? { message_thread_id: m.message_thread_id } : {}),
    });
    res.sendStatus(200);
  } catch {
    // Do not re-run a chargeable verification if only the reply failed.
    console.error(
      "Telegram reply failed; verification will not be retried automatically",
    );
    res.sendStatus(200);
  } finally {
    if (locked) busy.delete(m.from.id);
  }
});
module.exports = { router, matches };
