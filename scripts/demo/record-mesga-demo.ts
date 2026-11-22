/**
 * MESGA 100-Day Accelerator — Demo Recording Script
 * Screen Studio-style smooth zooms, scrolls, and transitions
 *
 * Usage:
 *   DEMO_EMAIL=x ADMIN_EMAIL=y DEMO_PASSWORD=z npx tsx scripts/demo/record-mesga-demo.ts
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
  outputName: 'mesga-demo',
  navigationTimeout: 60000,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function wait(page: Page, ms: number) {
  await page.waitForTimeout(ms);
}

async function safeGoto(page: Page, url: string) {
  await page.goto(url, { timeout: CONFIG.navigationTimeout, waitUntil: 'domcontentloaded' });
  // Wait a bit more for hydration
  await wait(page, 1500);
  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch {
    // networkidle sometimes hangs, domcontentloaded is enough
  }
}

/** Smooth scroll like Screen Studio — ease-in-out with variable speed */
async function smoothScroll(page: Page, distance: number, durationMs = 1500) {
  const steps = Math.max(20, Math.floor(durationMs / 30));
  // Use easeInOutCubic for natural feel
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

async function scrollToTop(page: Page) {
  await page.evaluate(`window.scrollTo({ top: 0, behavior: 'smooth' })`);
  await wait(page, 800);
}

/**
 * Screen Studio-style zoom effect
 * Smoothly zooms into a CSS selector, holds, then zooms back out
 */
async function zoomTo(page: Page, selector: string, scale = 1.8, holdMs = 2500) {
  // First ensure the element is in view
  try {
    await page.locator(selector).first().scrollIntoViewIfNeeded({ timeout: 3000 });
  } catch {
    // Element might not exist, skip zoom
    return;
  }
  await wait(page, 300);

  // Get element position for transform-origin
  const box = await page.locator(selector).first().boundingBox();
  if (!box) return;

  const originX = box.x + box.width / 2;
  const originY = box.y + box.height / 2;

  // Inject smooth zoom animation
  await page.evaluate(`
    (function() {
      var style = document.createElement('style');
      style.id = 'pw-zoom-style';
      style.textContent = \`
        .pw-zooming {
          transition: transform 0.8s cubic-bezier(0.25, 0.1, 0.25, 1.0) !important;
          transform-origin: ${originX}px ${originY}px !important;
        }
        .pw-zoom-in {
          transform: scale(${scale}) !important;
        }
        .pw-zoom-out {
          transform: scale(1) !important;
        }
      \`;
      var existing = document.getElementById('pw-zoom-style');
      if (existing) existing.remove();
      document.head.appendChild(style);

      document.documentElement.classList.add('pw-zooming');
      // Trigger zoom in
      requestAnimationFrame(function() {
        document.documentElement.classList.add('pw-zoom-in');
        document.documentElement.classList.remove('pw-zoom-out');
      });
    })()
  `);

  // Wait for zoom animation + hold
  await wait(page, 800 + holdMs);

  // Zoom back out
  await page.evaluate(`
    (function() {
      document.documentElement.classList.remove('pw-zoom-in');
      document.documentElement.classList.add('pw-zoom-out');
    })()
  `);
  await wait(page, 900);

  // Cleanup
  await page.evaluate(`
    (function() {
      document.documentElement.classList.remove('pw-zooming', 'pw-zoom-in', 'pw-zoom-out');
      var style = document.getElementById('pw-zoom-style');
      if (style) style.remove();
    })()
  `);
  await wait(page, 200);
}

/** Fade transition overlay between scenes */
async function fadeTransition(page: Page, durationMs = 600) {
  await page.evaluate(`
    (function() {
      var overlay = document.createElement('div');
      overlay.id = 'pw-fade';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0a0a0b;z-index:999999;opacity:0;transition:opacity ${durationMs / 2}ms ease;pointer-events:none;';
      document.body.appendChild(overlay);
      requestAnimationFrame(function() { overlay.style.opacity = '1'; });
    })()
  `);
  await wait(page, durationMs / 2 + 100);
}

async function fadeIn(page: Page, durationMs = 600) {
  await page.evaluate(`
    (function() {
      var overlay = document.getElementById('pw-fade');
      if (overlay) {
        overlay.style.transition = 'opacity ${durationMs / 2}ms ease';
        overlay.style.opacity = '0';
        setTimeout(function() { overlay.remove(); }, ${durationMs / 2 + 50});
      }
    })()
  `);
  await wait(page, durationMs / 2 + 100);
}

/** Inject custom cursor with glow effect */
async function injectCursor(page: Page) {
  try {
    const has = await page.evaluate(`!!document.getElementById('pw-cursor')`);
    if (has) return;
  } catch { /* page navigating */ }

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

/** Move cursor smoothly to an element before clicking */
async function smoothClick(page: Page, selector: string) {
  const el = page.locator(selector).first();
  try {
    await el.scrollIntoViewIfNeeded({ timeout: 3000 });
  } catch { /* skip */ }
  await wait(page, 200);
  const box = await el.boundingBox();
  if (box) {
    // Move mouse smoothly to target
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
    await wait(page, 150);
  }
  await el.click();
  await wait(page, 300);
}

/** Type text with realistic speed + cursor movement */
async function typeSlowly(page: Page, selector: string, text: string) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  const box = await el.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
    await wait(page, 100);
  }
  await el.click();
  await wait(page, 200);
  await el.pressSequentially(text, { delay: 35 });
  await wait(page, 300);
}

/** Show a scene title overlay */
async function showSceneTitle(page: Page, title: string, subtitle: string = '', durationMs = 2000) {
  await page.evaluate(`
    (function() {
      var overlay = document.createElement('div');
      overlay.id = 'pw-title';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(10,10,11,0.92);z-index:999990;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transition:opacity 0.5s ease;';
      overlay.innerHTML = '<div style="font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;text-align:center;"><h1 style="color:#fff;font-size:48px;font-weight:700;margin:0;letter-spacing:-1px;">${title.replace(/'/g, "\\'")}</h1>${subtitle ? '<p style="color:rgba(255,255,255,0.5);font-size:20px;margin-top:12px;font-weight:400;">' + subtitle.replace(/'/g, "\\'") + '</p>' : ''}</div>';
      document.body.appendChild(overlay);
      requestAnimationFrame(function() { overlay.style.opacity = '1'; });
    })()
  `);
  await wait(page, 500 + durationMs);

  await page.evaluate(`
    (function() {
      var overlay = document.getElementById('pw-title');
      if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(function() { overlay.remove(); }, 500);
      }
    })()
  `);
  await wait(page, 600);
}

// ─── Scenes ─────────────────────────────────────────────────────────────────

async function sceneIntro(page: Page) {
  console.log('🎬 Scene 0: Intro Title');
  // Show title card on blank page
  await safeGoto(page, `${CONFIG.baseUrl}/login`);
  await showSceneTitle(page, 'MESGA 100-Day Accelerator', 'Space-Tech Founder Acceleration Platform', 3000);
}

async function sceneLogin(page: Page) {
  console.log('🎬 Scene 1: Login');
  await injectCursor(page);
  await wait(page, 1000);

  // Zoom into the login form
  await zoomTo(page, 'form', 1.4, 1000);

  // Type credentials
  await typeSlowly(page, 'input[name="email"]', CONFIG.founderEmail);
  await typeSlowly(page, 'input[name="password"]', CONFIG.password);
  await wait(page, 400);

  // Click sign in with smooth cursor
  await smoothClick(page, 'button[type="submit"]');
  await page.waitForLoadState('networkidle').catch(() => {});
  await wait(page, 2500);
}

async function sceneDashboard(page: Page) {
  console.log('🎬 Scene 2: Dashboard');

  await fadeTransition(page);
  await safeGoto(page, CONFIG.baseUrl);
  await fadeIn(page);
  await injectCursor(page);
  await wait(page, 2000);

  // Show the dashboard overview
  await showSceneTitle(page, 'Founder Dashboard', 'Real-time program tracking & progress', 1500);

  // Smooth scroll through dashboard sections
  await smoothScroll(page, 600, 2000);
  await wait(page, 1500);

  // Zoom into timeline/progress area
  await zoomTo(page, '[class*="timeline"], [class*="Timeline"], [class*="progress"]', 1.6, 2500);

  // Continue scrolling
  await smoothScroll(page, 500, 1500);
  await wait(page, 1500);

  // Zoom into personality/archetype section if visible
  await zoomTo(page, '[class*="personality"], [class*="archetype"], [class*="Archetype"]', 1.5, 2000);

  await scrollToTop(page);
  await wait(page, 800);
}

async function sceneDailyForm(page: Page) {
  console.log('🎬 Scene 3: Daily Form — Day 1');

  await fadeTransition(page);
  await safeGoto(page, `${CONFIG.baseUrl}/day/daily-day-block-1`);
  await fadeIn(page);
  await injectCursor(page);

  await showSceneTitle(page, 'Daily Task Execution', 'Structured daily deliverables with auto-checks', 1500);

  await wait(page, 1500);

  // Zoom into the day metadata (commandment, theme, deliverable)
  await zoomTo(page, '[class*="Commandment"], [class*="commandment"], h1', 1.5, 2000);

  // Scroll to show questions
  await smoothScroll(page, 500, 1800);
  await wait(page, 1200);

  // Zoom into deliverable box
  await zoomTo(page, '[class*="Deliverable"], [class*="deliverable"], [class*="block-focus"]', 1.5, 2000);

  // Scroll more
  await smoothScroll(page, 400, 1500);
  await wait(page, 1000);

  await scrollToTop(page);
  await wait(page, 500);
}

async function sceneFastForward(page: Page) {
  console.log('🎬 Scene 4: Fast-Forward 100 Days');

  await fadeTransition(page);
  // Show title for this sequence
  await safeGoto(page, `${CONFIG.baseUrl}/day/daily-day-block-1`);
  await showSceneTitle(page, '100 Days of Execution', 'Daily tasks → Weekly retros → Gate decisions', 2000);
  await fadeIn(page);

  // Key days showing variety: standard, retro (7x), gate (15,30,50,70,94)
  const keyDays = [
    { day: 1, label: 'Day 1 — Foundation' },
    { day: 3, label: 'Day 3' },
    { day: 7, label: 'Week 1 Retro' },
    { day: 10, label: 'Day 10' },
    { day: 14, label: 'Week 2 Retro' },
    { day: 15, label: 'GATE 1 — First Checkpoint' },
    { day: 20, label: 'Day 20' },
    { day: 28, label: 'Week 4 Retro' },
    { day: 30, label: 'GATE 2 — Validation' },
    { day: 35, label: 'Day 35' },
    { day: 42, label: 'Week 6 Retro' },
    { day: 50, label: 'GATE 3 — Build Phase' },
    { day: 56, label: 'Week 8 Retro' },
    { day: 63, label: 'Day 63' },
    { day: 70, label: 'GATE 4 — Scale Phase' },
    { day: 77, label: 'Day 77' },
    { day: 84, label: 'Week 12 Retro' },
    { day: 90, label: 'Day 90' },
    { day: 94, label: 'GATE 5 — Final Gate' },
    { day: 98, label: 'Day 98' },
    { day: 100, label: 'Day 100 — Completion!' },
  ];

  for (const { day, label } of keyDays) {
    const isGate = [15, 30, 50, 70, 94].includes(day);
    const slug = isGate
      ? `daily-gate-block-${[15, 30, 50, 70, 94].indexOf(day) + 1}`
      : `daily-day-block-${day}`;

    await page.goto(`${CONFIG.baseUrl}/day/${slug}`, {
      timeout: CONFIG.navigationTimeout,
      waitUntil: 'domcontentloaded',
    }).catch(() => {});

    // Show day counter overlay
    await page.evaluate(`
      (function() {
        var existing = document.getElementById('pw-day-counter');
        if (existing) existing.remove();
        var counter = document.createElement('div');
        counter.id = 'pw-day-counter';
        counter.style.cssText = 'position:fixed;bottom:40px;right:40px;z-index:999990;font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;text-align:right;opacity:0;transition:opacity 0.2s ease;';
        counter.innerHTML = '<div style="background:rgba(10,10,11,0.85);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:16px 24px;backdrop-filter:blur(20px);"><div style="color:rgba(255,255,255,0.4);font-size:12px;text-transform:uppercase;letter-spacing:2px;">Day</div><div style="color:#fff;font-size:56px;font-weight:800;line-height:1;margin:4px 0;">${day}</div><div style="color:${isGate ? '#E4B94D' : 'rgba(255,255,255,0.5)'};font-size:13px;font-weight:${isGate ? '600' : '400'};">${label.replace(/'/g, "\\'")}</div></div>';
        document.body.appendChild(counter);
        requestAnimationFrame(function() { counter.style.opacity = '1'; });
      })()
    `);

    // Gates get more time
    const waitTime = isGate ? 1200 : day === 100 ? 2000 : 500;
    await wait(page, waitTime);
  }

  // Remove counter
  await page.evaluate(`
    (function() {
      var c = document.getElementById('pw-day-counter');
      if (c) { c.style.opacity = '0'; setTimeout(function() { c.remove(); }, 300); }
    })()
  `);
  await wait(page, 500);
}

async function sceneGateDecision(page: Page) {
  console.log('🎬 Scene 5: Gate Decision');

  await fadeTransition(page);
  await safeGoto(page, `${CONFIG.baseUrl}/day/daily-gate-block-1`);
  await fadeIn(page);
  await injectCursor(page);

  await showSceneTitle(page, 'Hard Gate Decisions', 'Pass / Revise / Stop — based on evidence, not impressions', 2000);

  await wait(page, 1500);

  // Scroll through gate form
  await smoothScroll(page, 600, 2000);
  await wait(page, 1500);

  await smoothScroll(page, 400, 1500);
  await wait(page, 1500);

  await scrollToTop(page);
  await wait(page, 800);
}

async function sceneEcosystem(page: Page) {
  console.log('🎬 Scene 6: Ecosystem Map');

  await fadeTransition(page);
  await safeGoto(page, `${CONFIG.baseUrl}/ecosystem`);
  await fadeIn(page);
  await injectCursor(page);

  await showSceneTitle(page, 'Ecosystem Intelligence Map', 'Galileo-powered geolocation of ESA BICs, investors & hubs', 2000);

  await wait(page, 2000);

  // Scroll through ecosystem items
  await smoothScroll(page, 500, 1800);
  await wait(page, 1500);

  // Zoom into an ecosystem card
  await zoomTo(page, '[class*="ecosystem"], [class*="Ecosystem"], main > div', 1.4, 2000);

  await scrollToTop(page);
  await wait(page, 800);
}

async function sceneMentor(page: Page) {
  console.log('🎬 Scene 7: Mentor Review');

  await fadeTransition(page);
  await safeGoto(page, `${CONFIG.baseUrl}/mentor`);
  await fadeIn(page);
  await injectCursor(page);

  await showSceneTitle(page, 'Mentor Review Workflow', 'Auto-checks + AI summaries → Mentor decisions', 1500);

  await wait(page, 2000);

  // Scroll through submissions
  await smoothScroll(page, 500, 1800);
  await wait(page, 1500);

  await smoothScroll(page, 400, 1500);
  await wait(page, 1500);

  await scrollToTop(page);
  await wait(page, 800);
}

async function sceneAdmin(page: Page) {
  console.log('🎬 Scene 8: Admin / Copernicus Data');

  await fadeTransition(page);

  // Navigate to admin
  await safeGoto(page, `${CONFIG.baseUrl}/admin/login`);
  await injectCursor(page);

  // Login as admin if needed
  try {
    const emailField = page.locator('#field-email');
    if (await emailField.isVisible({ timeout: 3000 })) {
      await emailField.fill(CONFIG.adminEmail);
      await page.locator('#field-password').fill(CONFIG.password);
      await wait(page, 300);
      await page.locator('button[type="submit"]').click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await wait(page, 2000);
    }
  } catch {
    // Already logged in
  }
  await fadeIn(page);

  await showSceneTitle(page, 'Copernicus & Galileo Integration', 'Live STAC API — real satellite data in every cohort', 2000);

  // Show project submissions (space data relevance)
  await safeGoto(page, `${CONFIG.baseUrl}/admin/collections/project-submissions`);
  await injectCursor(page);
  await wait(page, 2000);

  await smoothScroll(page, 400, 1500);
  await wait(page, 1500);

  // Show day definitions (curriculum)
  await fadeTransition(page);
  await safeGoto(page, `${CONFIG.baseUrl}/admin/collections/day-definitions`);
  await fadeIn(page);
  await injectCursor(page);
  await wait(page, 2000);

  await smoothScroll(page, 400, 1500);
  await wait(page, 1500);
}

async function scenePayment(page: Page) {
  console.log('🎬 Scene 9: Payment Infrastructure');

  await fadeTransition(page);
  await safeGoto(page, `${CONFIG.baseUrl}/payment`);
  await fadeIn(page);
  await injectCursor(page);

  await showSceneTitle(page, 'Payment Infrastructure', 'PayNow integration — SaaS subscription + institutional licensing', 1500);

  await wait(page, 2500);

  // Zoom into payment form
  await zoomTo(page, 'form, [class*="payment"], [class*="Payment"], main', 1.4, 2000);
}

async function sceneClosing(page: Page) {
  console.log('🎬 Scene 10: Closing');

  await fadeTransition(page);

  // Re-login as founder for closing dashboard shot
  await safeGoto(page, `${CONFIG.baseUrl}/login`);
  try {
    await page.locator('input[name="email"]').fill(CONFIG.founderEmail);
    await page.locator('input[name="password"]').fill(CONFIG.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await wait(page, 1500);
  } catch {
    await safeGoto(page, CONFIG.baseUrl);
  }

  await fadeIn(page);
  await injectCursor(page);
  await wait(page, 2000);

  // Final dashboard shot with slow scroll
  await smoothScroll(page, 400, 2500);
  await wait(page, 1500);

  // Closing title
  await showSceneTitle(page, 'MESGA', 'Accelerating space-tech founders — 100 days at a time', 3500);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   MESGA 100-Day Accelerator — Demo Recording     ║');
  console.log('║   Screen Studio-style: zooms, fades, overlays    ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Target: ${CONFIG.baseUrl}`);
  console.log(`Output: ${CONFIG.outputDir}/${CONFIG.outputName}.webm`);
  console.log('');

  if (!CONFIG.founderEmail || !CONFIG.password) {
    console.error('❌ Set DEMO_EMAIL, ADMIN_EMAIL, DEMO_PASSWORD env vars');
    process.exit(1);
  }

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

  // Set default timeout
  context.setDefaultTimeout(CONFIG.navigationTimeout);

  const page = await context.newPage();

  try {
    await sceneIntro(page);
    await sceneLogin(page);
    await sceneDashboard(page);
    await sceneDailyForm(page);
    await sceneFastForward(page);
    await sceneGateDecision(page);
    await sceneEcosystem(page);
    await sceneMentor(page);
    await sceneAdmin(page);
    await scenePayment(page);
    await sceneClosing(page);

    console.log('');
    console.log('✅ All scenes recorded!');
  } catch (error) {
    console.error('❌ Recording failed:', error);
  }

  // Save video
  await context.close();
  await browser.close();

  // Rename output
  const files = fs.readdirSync(CONFIG.outputDir).filter((f) => f.endsWith('.webm'));
  const latest = files.sort().pop();
  if (latest) {
    const src = path.join(CONFIG.outputDir, latest);
    const dest = path.join(CONFIG.outputDir, `${CONFIG.outputName}.webm`);
    if (src !== dest) {
      try { fs.unlinkSync(dest); } catch { /* doesn't exist */ }
      fs.renameSync(src, dest);
    }
    console.log(`📹 Raw: ${dest}`);
    console.log('');
    console.log('Post-processing commands:');
    console.log('');
    console.log('  # Convert to MP4 (high quality):');
    console.log(`  ffmpeg -i "${dest}" -c:v libx264 -crf 18 -preset slow -movflags faststart "${dest.replace('.webm', '.mp4')}"`);
    console.log('');
    console.log('  # Optional: add background music:');
    console.log(`  ffmpeg -i "${dest.replace('.webm', '.mp4')}" -i music.mp3 -c:v copy -c:a aac -map 0:v -map 1:a -shortest "${dest.replace('.webm', '-final.mp4')}"`);
    console.log('');
  }
}

main().catch(console.error);
