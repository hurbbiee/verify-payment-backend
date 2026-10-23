const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const safeError = message => Object.assign(new Error(message), { safe: true });
async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const base = process.env.PUBLIC_BASE_URL?.trim();
  const missing = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'PUBLIC_BASE_URL'].filter(key => !process.env[key]?.trim());
  if (missing.length) throw safeError('Missing configuration: ' + missing.join(', ') + ' in backend/.env');
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) throw safeError('TELEGRAM_WEBHOOK_SECRET: use letters, digits, _ or - only (1-256 characters)');
  let url;
  try {
    const origin = new URL(base);
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error();
    url = new URL('/api/telegram/webhook', origin);
  } catch { throw safeError('PUBLIC_BASE_URL must be an HTTPS origin, e.g. https://your-backend.onrender.com'); }
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.href, secret_token: secret, allowed_updates: ['message'] }),
      signal: AbortSignal.timeout(30000), redirect: 'error',
    });
  } catch (error) {
    throw safeError(error.name === 'TimeoutError' ? 'Timed out contacting Telegram. Try again.' : 'Cannot connect to api.telegram.org. Check network, DNS or proxy.');
  }
  let result;
  try { result = await response.json(); }
  catch { throw safeError(`Telegram returned non-JSON response (HTTP ${response.status})`); }
  if (!response.ok || !result.ok) {
    let description = typeof result.description === 'string' ? result.description : 'No description';
    for (const privateValue of [token, secret]) description = description.split(privateValue).join('[REDACTED]');
    throw safeError(`Telegram HTTP ${response.status}: ${description}`);
  }
  console.log('Webhook registered successfully');
}
main().catch(error => {
  console.error('Webhook registration failed:', error.safe ? error.message : 'Unexpected error; no sensitive details printed');
  process.exitCode = 1;
});
