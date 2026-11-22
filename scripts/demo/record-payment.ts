/**
 * Re-record just the payment scene.
 *
 * Steps:
 *   1. Login as admin → toggle hasPaid100Days=false on the founder
 *   2. Login as founder → record payment page
 *   3. Restore hasPaid100Days=true
 *
 * Usage:
 *   DEMO_EMAIL=x ADMIN_EMAIL=y DEMO_PASSWORD=z npx tsx scripts/demo/record-payment.ts
 */

import { chromium, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG = {
  baseUrl: process.env.DEMO_URL || 'http://localhost:3000',
  founderEmail: process.env.DEMO_EMAIL || '',
  adminEmail: process.env.ADMIN_EMAIL || '',
  password: process.env.DEMO_PASSWORD || '',
  viewport: { width: 1920, height: 1080 },
  slowMo: 50,
  outputDir: path.resolve(__dirname, '../../recordings'),
  outputName: 'payment',
  navigationTimeout: 60000,
};

// ─── Helpers (same as main script) ───────────────────────────────────────────

async function wait(page: Page, ms: number) {
  await page.waitForTimeout(ms);
}

async function safeGoto(page: Page, url: string) {
  await page.goto(url, { timeout: CONFIG.navigationTimeout, waitUntil: 'domcontentloaded' });
  await wait(page, 1500);
  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch {}
}

async function smoothScroll(page: Page, distance: number, durationMs = 1500) {
  const steps = Math.max(20, Math.floor(durationMs / 30));
  await page.evaluate(`
    (function() {
      var start = window.scrollY;
      var distance = ${distance};
      var steps = ${steps};
      var step = 0;
      function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      }
      function doStep() {
        step++;
        var t = step / steps;
        var eased = easeInOutCubic(t);
        window.scrollTo(0, start + distance * eased);
        if (step < steps) requestAnimationFrame(doStep);
      }
      requestAnimationFrame(doStep);
    })()
  `);
  await wait(page, durationMs + 100);
}

async function zoomTo(page: Page, selector: string, scale = 1.8, holdMs = 2500) {
  try {
    await page.locator(selector).first().scrollIntoViewIfNeeded({ timeout: 3000 });
  } catch { return; }
  await wait(page, 300);

  const box = await page.locator(selector).first().boundingBox();
  if (!box) return;

  const originX = box.x + box.width / 2;
  const originY = box.y + box.height / 2;

  await page.evaluate(`
    (function() {
      var style = document.createElement('style');
      style.id = 'pw-zoom-style';
      style.textContent = \`
        .pw-zooming {
          transition: transform 0.8s cubic-bezier(0.25, 0.1, 0.25, 1.0) !important;
          transform-origin: ${originX}px ${originY}px !important;
        }
        .pw-zoom-in { transform: scale(${scale}) !important; }
        .pw-zoom-out { transform: scale(1) !important; }
      \`;
      var existing = document.getElementById('pw-zoom-style');
      if (existing) existing.remove();
      document.head.appendChild(style);
      document.documentElement.classList.add('pw-zooming');
      requestAnimationFrame(function() {
        document.documentElement.classList.add('pw-zoom-in');
        document.documentElement.classList.remove('pw-zoom-out');
      });
    })()
  `);
  await wait(page, 800 + holdMs);

  await page.evaluate(`
    (function() {
      document.documentElement.classList.remove('pw-zoom-in');
      document.documentElement.classList.add('pw-zoom-out');
    })()
  `);
  await wait(page, 900);

  await page.evaluate(`
    (function() {
      document.documentElement.classList.remove('pw-zooming', 'pw-zoom-in', 'pw-zoom-out');
      var style = document.getElementById('pw-zoom-style');
      if (style) style.remove();
    })()
  `);
  await wait(page, 200);
}

async function injectCursor(page: Page) {
  try {
    const has = await page.evaluate(`!!document.getElementById('pw-cursor')`);
    if (has) return;
  } catch {}

  await page.addStyleTag({
    content: `
      * { cursor: none !important; }
      .pw-cursor {
        position: fixed; width: 22px; height: 22px;
        background: radial-gradient(circle, rgba(11,157,247,0.8) 0%, rgba(11,157,247,0.15) 60%, transparent 100%);
        border: 2px solid rgba(11,157,247,0.95);
        border-radius: 50%; pointer-events: none; z-index: 999999;
        transform: translate(-50%, -50%);
        transition: transform 0.12s ease, width 0.12s ease, height 0.12s ease;
        box-shadow: 0 0 16px rgba(11,157,247,0.5), 0 0 4px rgba(11,157,247,0.8);
      }
      .pw-cursor.clicking {
        transform: translate(-50%, -50%) scale(0.65);
        box-shadow: 0 0 24px rgba(2,58,243,0.8), 0 0 8px rgba(2,58,243,1);
      }
      .pw-click-ring {
        position: fixed; width: 30px; height: 30px; border-radius: 50%;
        border: 2px solid rgba(11,157,247,0.6); pointer-events: none; z-index: 999998;
        transform: translate(-50%, -50%) scale(0); opacity: 1;
        animation: pw-ring 0.6s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
      }
      @keyframes pw-ring {
        to { transform: translate(-50%, -50%) scale(3); opacity: 0; }
      }
    `,
  });

  await page.evaluate(`
    (function() {
      var cursor = document.createElement('div');
      cursor.className = 'pw-cursor';
      cursor.id = 'pw-cursor';
      document.body.appendChild(cursor);
      document.addEventListener('mousemove', function(e) {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
      });
      document.addEventListener('mousedown', function() {
        cursor.classList.add('clicking');
        var ring = document.createElement('div');
        ring.className = 'pw-click-ring';
        ring.style.left = cursor.style.left;
        ring.style.top = cursor.style.top;
        document.body.appendChild(ring);
        setTimeout(function() { ring.remove(); }, 600);
      });
      document.addEventListener('mouseup', function() {
        cursor.classList.remove('clicking');
      });
    })()
  `);
}

// ─── Payload API helpers ─────────────────────────────────────────────────────

async function loginPayloadAPI(email: string, password: string): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${CONFIG.baseUrl}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.token) throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  return { token: data.token, userId: data.user?.id };
}

async function findUserByEmail(token: string, email: string): Promise<string> {
  const res = await fetch(
    `${CONFIG.baseUrl}/api/users?where[email][equals]=${encodeURIComponent(email)}&limit=1`,
    { headers: { Authorization: `JWT ${token}` } },
  );
  const data = await res.json();
  if (!data.docs?.[0]?.id) throw new Error(`User not found: ${email}`);
  return data.docs[0].id;
}

async function updateUser(token: string, userId: string, updates: Record<string, unknown>) {
  const res = await fetch(`${CONFIG.baseUrl}/api/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `JWT ${token}`,
    },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (data.errors) throw new Error(`Update failed: ${JSON.stringify(data.errors)}`);
  return data;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   MESGA — Payment Scene Re-recording      ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  if (!CONFIG.founderEmail || !CONFIG.adminEmail || !CONFIG.password) {
    console.error('❌ Set DEMO_EMAIL, ADMIN_EMAIL, DEMO_PASSWORD env vars');
    process.exit(1);
  }

  // Step 1: Toggle hasPaid100Days OFF via API
  console.log('🔧 Step 1: Temporarily setting hasPaid100Days=false...');
  const admin = await loginPayloadAPI(CONFIG.adminEmail, CONFIG.password);
  const founderId = await findUserByEmail(admin.token, CONFIG.founderEmail);
  console.log(`   Found founder: ${founderId}`);

  await updateUser(admin.token, founderId, { hasPaid100Days: false });
  console.log('   ✓ hasPaid100Days = false');

  // Step 2: Record payment page
  console.log('');
  console.log('🎬 Step 2: Recording payment page...');

  fs.mkdirSync(CONFIG.outputDir, { recursive: true });

  const browser = await chromium.launch({
    slowMo: CONFIG.slowMo,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: CONFIG.viewport,
    recordVideo: {
      dir: CONFIG.outputDir,
      size: CONFIG.viewport,
    },
    colorScheme: 'dark',
  });
  context.setDefaultTimeout(CONFIG.navigationTimeout);

  const page = await context.newPage();

  try {
    // Login via API + cookie injection (no visible login screen)
    const founder = await loginPayloadAPI(CONFIG.founderEmail, CONFIG.password);
    await context.addCookies([{
      name: 'payload-token',
      value: founder.token,
      domain: new URL(CONFIG.baseUrl).hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    }]);

    // Go directly to payment — no login screen
    await safeGoto(page, `${CONFIG.baseUrl}/payment`);
    await injectCursor(page);

    // Hold on full page overview
    await wait(page, 3000);

    // Zoom into the pricing / access card
    await zoomTo(page, 'h1, h2, [class*="Activate"], [class*="Access"]', 1.5, 3000);

    // Zoom into the price display
    await zoomTo(page, '[class*="price"], [class*="Price"], [class*="amount"], [class*="free"], [class*="Free"]', 1.8, 3000);

    // Show the invoice checkbox area
    await smoothScroll(page, 200, 1200);
    await wait(page, 1500);

    // Zoom into the action button
    await zoomTo(page, 'button[type="submit"], button:has-text("Activate"), button:has-text("Pay")', 1.6, 3000);

    // Hold on full view one more time
    await wait(page, 2000);

    console.log('   ✓ Payment scene recorded');
  } catch (error) {
    console.error('   ❌ Recording failed:', error);
  }

  // Save video
  await context.close();
  await browser.close();

  // Step 3: Restore hasPaid100Days
  console.log('');
  console.log('🔧 Step 3: Restoring hasPaid100Days=true...');
  // Re-login as admin (token may have expired)
  const admin2 = await loginPayloadAPI(CONFIG.adminEmail, CONFIG.password);
  await updateUser(admin2.token, founderId, { hasPaid100Days: true });
  console.log('   ✓ hasPaid100Days = true (restored)');

  // Step 4: Rename & convert
  const files = fs.readdirSync(CONFIG.outputDir).filter((f) => f.endsWith('.webm'));
  const latest = files.sort().pop();
  if (latest) {
    const src = path.join(CONFIG.outputDir, latest);
    const dest = path.join(CONFIG.outputDir, `${CONFIG.outputName}.webm`);
    if (src !== dest) {
      try { fs.unlinkSync(dest); } catch {}
      fs.renameSync(src, dest);
    }
    console.log(`📹 Raw: ${dest}`);
    console.log('');
    console.log('Convert to MP4:');
    const mp4 = dest.replace('.webm', '.mp4');
    console.log(`  ffmpeg -y -i "${dest}" -c:v libx264 -crf 18 -preset slow -movflags faststart "${mp4}"`);

    // Also copy to video/public/demos/
    const demoDest = path.resolve(__dirname, '../../video/public/demos/payment.mp4');
    console.log(`  Then copy: cp "${mp4}" "${demoDest}"`);
  }
}

main().catch(console.error);
