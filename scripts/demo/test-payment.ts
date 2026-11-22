import { chromium } from 'playwright';

const CONFIG = {
  baseUrl: process.env.DEMO_URL || 'http://localhost:3000',
  founderEmail: process.env.DEMO_EMAIL || '',
  adminEmail: process.env.ADMIN_EMAIL || '',
  password: process.env.DEMO_PASSWORD || '',
};

async function loginAPI(email: string, password: string) {
  const res = await fetch(`${CONFIG.baseUrl}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

async function findUser(token: string, email: string) {
  const res = await fetch(
    `${CONFIG.baseUrl}/api/users?where[email][equals]=${encodeURIComponent(email)}&limit=1`,
    { headers: { Authorization: `JWT ${token}` } },
  );
  const data = await res.json();
  return data.docs?.[0];
}

async function updateUser(token: string, userId: string, updates: Record<string, unknown>) {
  await fetch(`${CONFIG.baseUrl}/api/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
    body: JSON.stringify(updates),
  });
}

async function main() {
  // Step 1: Check current state
  const admin = await loginAPI(CONFIG.adminEmail, CONFIG.password);
  const founder = await findUser(admin.token, CONFIG.founderEmail);
  console.log('Founder hasPaid100Days:', founder.hasPaid100Days);
  console.log('Founder programStatus:', founder.programStatus);

  // Step 2: Set hasPaid100Days=false
  await updateUser(admin.token, founder.id, { hasPaid100Days: false });
  const updated = await findUser(admin.token, CONFIG.founderEmail);
  console.log('After update hasPaid100Days:', updated.hasPaid100Days);

  // Step 3: Login as founder and try to navigate to /payment
  const founderLogin = await loginAPI(CONFIG.founderEmail, CONFIG.password);
  console.log('Founder token:', founderLogin.token ? 'OK' : 'FAIL');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: 'dark' });

  await context.addCookies([{
    name: 'payload-token',
    value: founderLogin.token,
    domain: new URL(CONFIG.baseUrl).hostname,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }]);

  const page = await context.newPage();
  await page.goto(`${CONFIG.baseUrl}/payment`, { timeout: 30000, waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('Final URL:', page.url());
  const title = await page.title();
  console.log('Page title:', title);

  // Take a screenshot to see what's showing
  await page.screenshot({ path: '/home/eduard/Pulpit/mesga-full/mesga-app/recordings/payment-debug.png' });
  console.log('Screenshot saved to recordings/payment-debug.png');

  await context.close();
  await browser.close();

  // Restore
  await updateUser(admin.token, founder.id, { hasPaid100Days: true });
  console.log('Restored hasPaid100Days=true');
}

main().catch(console.error);
