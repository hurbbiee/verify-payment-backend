require("dotenv").config({ quiet: true });
async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const base = process.env.PUBLIC_BASE_URL;
  if (!token || !secret || !base)
    throw new Error(
      "Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and PUBLIC_BASE_URL",
    );
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret))
    throw new Error(
      "Webhook secret must contain only letters, numbers, _ or - (1-256 characters)",
    );
  const url = new URL("/api/telegram/webhook", base);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("PUBLIC_BASE_URL must be a public HTTPS origin");
  const response = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: url.href,
        secret_token: secret,
        allowed_updates: ["message"],
      }),
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    },
  );
  const result = await response.json();
  if (!response.ok || !result.ok)
    throw new Error("Registration failed; check token and public backend URL");
  console.log("Webhook registered successfully");
}
main().catch(() => {
  console.error(
    "Webhook registration failed. Check configuration and backend deployment.",
  );
  process.exitCode = 1;
});
