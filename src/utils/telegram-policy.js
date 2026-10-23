function list(value) {
  return (value ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
function groupPolicy(message, env = process.env) {
  const group = ["group", "supergroup"].includes(message.chat?.type);
  const raw = (message.text ?? message.caption ?? "").split(/\s/)[0];
  const [name, target] = raw.split("@");
  const username = (env.TELEGRAM_BOT_USERNAME ?? "qc_sleep_bot").replace(
    /^@/,
    "",
  );
  const command =
    target && target.toLowerCase() !== username.toLowerCase() ? "" : name;
  const allowedUser = list(env.TELEGRAM_ALLOWED_USER_IDS).includes(
    String(message.from?.id),
  );
  const allowedChat =
    !group ||
    list(env.TELEGRAM_ALLOWED_CHAT_IDS).includes(String(message.chat.id));
  return { group, command, allowedUser, allowedChat };
}
module.exports = { groupPolicy };
