/**
 * Telegram notifications for MESGA platform errors, warnings, and critical events.
 * Sends messages to the Mesga Telegram group via bot API.
 */

const BOT_TOKEN = '8693254438:AAHUe2NU5t8Ukrm2fSE-e-x1O7k3Iu8lOE4'
const CHAT_ID = '-5124060995'
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`

type Severity = 'error' | 'warning' | 'info'

const SEVERITY_EMOJI: Record<Severity, string> = {
  error: '🔴',
  warning: '🟡',
  info: '🔵',
}

/**
 * Send a notification to the Mesga Telegram group.
 * Fires and forgets — never throws so it doesn't break the caller.
 */
export async function notifyTelegram(
  severity: Severity,
  title: string,
  details?: string,
): Promise<void> {
  const emoji = SEVERITY_EMOJI[severity]
  const env = process.env.NODE_ENV === 'production' ? 'PROD' : 'DEV'
  let text = `${emoji} <b>[${env}] ${title}</b>`
  if (details) {
    // Truncate to avoid Telegram's 4096 char limit
    const truncated = details.length > 3500 ? details.slice(0, 3500) + '…' : details
    text += `\n\n<pre>${escapeHtml(truncated)}</pre>`
  }

  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
  } catch {
    // Silent fail — don't let Telegram issues break the app
    console.error('[telegram] Failed to send notification')
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
