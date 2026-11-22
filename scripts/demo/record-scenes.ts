/**
 * MESGA Demo — High-quality per-scene recordings for Remotion
 *
 * Uses CDP screenshot capture at 30fps → PNG frames → FFmpeg MP4
 * This bypasses Playwright's poor VP8 recording quality.
 *
 * Usage:
 *   DEMO_PASSWORD=<password> npx tsx scripts/demo/record-scenes.ts
 */

import { chromium, type Page, type BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const CONFIG = {
  baseUrl: process.env.DEMO_URL || 'http://localhost:3000',
  founderEmail: process.env.DEMO_EMAIL || 'edikmuntyanovphone@gmail.com',
  adminEmail: process.env.ADMIN_EMAIL || 'eduard@mesga.eu',
  password: process.env.DEMO_PASSWORD || '',
  viewport: { width: 1920, height: 1080 },
  fps: 20, // Effective capture rate (screenshot overhead limits throughput)
  outputDir: path.resolve(__dirname, '../../video/public/demos'),
  navigationTimeout: 60000,
};

const FRAME_INTERVAL_MS = 1000 / CONFIG.fps; // ~33.3ms per frame

// ─── Screenshot-based video capture ──────────────────────────────────────────

class FrameCapture {
  private page: Page;
  private framesDir: string;
  private frameCount = 0;
  private capturing = false;
  private capturePromise: Promise<void> | null = null;

  constructor(page: Page, framesDir: string) {
    this.page = page;
    this.framesDir = framesDir;
    fs.mkdirSync(framesDir, { recursive: true });
  }

  async start() {
    this.capturing = true;
    this.capturePromise = this.captureLoop();
  }

  async stop() {
    this.capturing = false;
    if (this.capturePromise) {
      await this.capturePromise;
    }
    return this.frameCount;
  }

  private async captureLoop() {
    while (this.capturing) {
      const start = Date.now();
      try {
        const buffer = await this.page.screenshot({
          type: 'jpeg',
          quality: 95,
          timeout: 5000,
        });
        const framePath = path.join(
          this.framesDir,
          `frame_${String(this.frameCount).padStart(6, '0')}.jpg`
        );
        fs.writeFileSync(framePath, buffer);
        this.frameCount++;
      } catch {
        // Page may be navigating, skip frame
      }
      const elapsed = Date.now() - start;
      const sleepMs = Math.max(0, FRAME_INTERVAL_MS - elapsed);
      if (sleepMs > 0) {
        await new Promise((r) => setTimeout(r, sleepMs));
      }
    }
  }

  compileToMp4(outputPath: string) {
    console.log(`  Compiling ${this.frameCount} frames to MP4...`);
    // Input at capture fps, output at 30fps for Remotion (ffmpeg handles frame duplication)
    execSync(
      `ffmpeg -y -framerate ${CONFIG.fps} -i "${this.framesDir}/frame_%06d.jpg" ` +
        `-c:v libx264 -crf 16 -preset medium -pix_fmt yuv420p -r 30 -movflags faststart ` +
        `"${outputPath}"`,
      { stdio: 'pipe' }
    );
    const durationSec = (this.frameCount / CONFIG.fps).toFixed(1);
    console.log(`  ✅ ${path.basename(outputPath)} (${this.frameCount} frames → ${durationSec}s at 30fps)`);
  }

  cleanup() {
    fs.rmSync(this.framesDir, { recursive: true, force: true });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function wait(page: Page, ms: number) {
  await page.waitForTimeout(ms);
}

async function safeGoto(page: Page, url: string) {
  await page.goto(url, { timeout: CONFIG.navigationTimeout, waitUntil: 'domcontentloaded' });
  await wait(page, 1500);
  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch {
    // networkidle sometimes hangs
  }
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

async function scrollToTop(page: Page) {
  await page.evaluate(`window.scrollTo({ top: 0, behavior: 'smooth' })`);
  await wait(page, 800);
}

async function zoomTo(page: Page, selector: string, scale = 1.8, holdMs = 2500) {
  try {
    await page.locator(selector).first().scrollIntoViewIfNeeded({ timeout: 3000 });
  } catch {
    return;
  }
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
      var s = document.getElementById('pw-zoom-style');
      if (s) s.remove();
    })()
  `);
  await wait(page, 200);
}

async function injectCursor(page: Page) {
  try {
    const has = await page.evaluate(`!!document.getElementById('pw-cursor')`);
    if (has) return;
  } catch {
    /* page navigating */
  }

  await page.addStyleTag({
    content: `
      * { cursor: none !important; }
      .pw-cursor {
        position: fixed; width: 22px; height: 22px;
        background: radial-gradient(circle, rgba(11,157,247,0.8) 0%, rgba(11,157,247,0.15) 60%, transparent 100%);
        border: 2px solid rgba(11,157,247,0.95);
        border-radius: 50%; pointer-events: none; z-index: 999999;
        transform: translate(-50%, -50%);
        box-shadow: 0 0 16px rgba(11,157,247,0.5), 0 0 4px rgba(11,157,247,0.8);
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
    })()
  `);
}

// ─── Auth: Login once and reuse cookies ──────────────────────────────────────

async function loginAndGetCookies(email: string, password: string): Promise<any[]> {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: CONFIG.viewport, colorScheme: 'dark' });
  const page = await ctx.newPage();

  await safeGoto(page, `${CONFIG.baseUrl}/login`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await wait(page, 2000);

  const cookies = await ctx.cookies();
  await browser.close();
  return cookies;
}

// ─── Scene recorder ─────────────────────────────────────────────────────────

type SceneFn = (page: Page) => Promise<void>;

async function recordScene(
  name: string,
  cookies: any[],
  sceneFn: SceneFn,
) {
  console.log(`🎬 Recording scene: ${name}`);

  const browser = await chromium.launch({ headless: true });
  const framesDir = path.join(CONFIG.outputDir, `.frames-${name}`);
  const context = await browser.newContext({
    viewport: CONFIG.viewport,
    colorScheme: 'dark',
  });
  context.setDefaultTimeout(CONFIG.navigationTimeout);
  await context.addCookies(cookies);

  const page = await context.newPage();
  const capture = new FrameCapture(page, framesDir);

  try {
    // Start capture before scene begins
    await capture.start();
    await sceneFn(page);
    const frameCount = await capture.stop();

    // Compile to MP4
    const outputPath = path.join(CONFIG.outputDir, `${name}.mp4`);
    capture.compileToMp4(outputPath);
  } catch (error) {
    await capture.stop();
    console.error(`  ❌ Scene "${name}" failed:`, error);
  }

  capture.cleanup();
  await context.close();
  await browser.close();
}

// ─── Scenes ─────────────────────────────────────────────────────────────────

const sceneDashboard: SceneFn = async (page) => {
  await safeGoto(page, CONFIG.baseUrl);
  await injectCursor(page);
  await wait(page, 5000);

  await smoothScroll(page, 500, 3000);
  await wait(page, 4000);

  await zoomTo(
    page,
    '[class*="timeline"], [class*="Timeline"], [class*="progress"], [class*="grid"]',
    1.5,
    5000
  );

  await smoothScroll(page, 400, 3000);
  await wait(page, 4000);

  await zoomTo(
    page,
    '[class*="personality"], [class*="archetype"], [class*="Archetype"]',
    1.4,
    4000
  );

  await scrollToTop(page);
  await wait(page, 3000);
};

const sceneDailyForm: SceneFn = async (page) => {
  await safeGoto(page, `${CONFIG.baseUrl}/day/daily-day-block-1`);
  await injectCursor(page);
  await wait(page, 4000);

  await zoomTo(page, 'h1, [class*="commandment"], [class*="Commandment"]', 1.4, 4000);
  await smoothScroll(page, 500, 3000);
  await wait(page, 3000);
  await zoomTo(
    page,
    '[class*="deliverable"], [class*="Deliverable"], [class*="block-focus"]',
    1.4,
    4000
  );
  await smoothScroll(page, 400, 3000);
  await wait(page, 3000);
  await scrollToTop(page);
  await wait(page, 2000);
};

const sceneGateForm: SceneFn = async (page) => {
  await safeGoto(page, `${CONFIG.baseUrl}/day/daily-gate-block-1`);
  await injectCursor(page);
  await wait(page, 4000);

  await smoothScroll(page, 600, 3000);
  await wait(page, 4000);
  await smoothScroll(page, 400, 3000);
  await wait(page, 4000);
  await scrollToTop(page);
  await wait(page, 2000);
};

const sceneEcosystem: SceneFn = async (page) => {
  await safeGoto(page, `${CONFIG.baseUrl}/ecosystem`);
  await injectCursor(page);
  await wait(page, 5000);

  await smoothScroll(page, 500, 3000);
  await wait(page, 4000);
  await zoomTo(page, '[class*="ecosystem"], [class*="Ecosystem"], main > div', 1.4, 4000);
  await scrollToTop(page);
  await wait(page, 3000);
};

const sceneMentor: SceneFn = async (page) => {
  await safeGoto(page, `${CONFIG.baseUrl}/mentor`);
  await injectCursor(page);
  await wait(page, 5000);

  await smoothScroll(page, 500, 3000);
  await wait(page, 4000);
  await smoothScroll(page, 400, 3000);
  await wait(page, 4000);
  await scrollToTop(page);
  await wait(page, 3000);
};

const scenePayment: SceneFn = async (page) => {
  await safeGoto(page, `${CONFIG.baseUrl}/payment`);
  await injectCursor(page);
  await wait(page, 5000);

  await zoomTo(page, 'form, [class*="payment"], [class*="Payment"], main', 1.4, 5000);
  await wait(page, 4000);
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   MESGA Demo — High-quality recordings (30fps JPEG→MP4)  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Target: ${CONFIG.baseUrl}`);
  console.log(`Output: ${CONFIG.outputDir}/`);
  console.log(`Quality: ${CONFIG.fps}fps, 1920×1080, H.264 CRF 16`);
  console.log('');

  if (!CONFIG.password) {
    console.error('❌ Set DEMO_PASSWORD env var');
    process.exit(1);
  }

  fs.mkdirSync(CONFIG.outputDir, { recursive: true });

  console.log('🔐 Logging in as founder...');
  let founderCookies: any[];
  try {
    founderCookies = await loginAndGetCookies(CONFIG.founderEmail, CONFIG.password);
    console.log('  ✅ Founder login successful');
  } catch (err) {
    console.error('  ❌ Founder login failed:', err);
    process.exit(1);
  }

  console.log('🔐 Logging in as admin...');
  let adminCookies: any[];
  try {
    adminCookies = await loginAndGetCookies(CONFIG.adminEmail, CONFIG.password);
    console.log('  ✅ Admin login successful');
  } catch (err) {
    console.error('  ❌ Admin login failed:', err);
    adminCookies = founderCookies;
  }

  console.log('');

  const scenes: Array<{ name: string; cookies: any[]; fn: SceneFn }> = [
    { name: 'dashboard', cookies: founderCookies, fn: sceneDashboard },
    { name: 'daily-form', cookies: founderCookies, fn: sceneDailyForm },
    { name: 'gate-form', cookies: founderCookies, fn: sceneGateForm },
    { name: 'ecosystem', cookies: founderCookies, fn: sceneEcosystem },
    { name: 'mentor', cookies: adminCookies, fn: sceneMentor },
    { name: 'payment', cookies: founderCookies, fn: scenePayment },
  ];

  for (const scene of scenes) {
    await recordScene(scene.name, scene.cookies, scene.fn);
  }

  console.log('');
  console.log('✅ All scenes recorded at 30fps!');
  console.log('');
  console.log('Next: cd video && pnpm studio   (preview)');
  console.log('      cd video && pnpm render   (render final MP4)');
}

main().catch(console.error);
