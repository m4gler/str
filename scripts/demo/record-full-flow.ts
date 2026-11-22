import { chromium, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * MESGA Demo — Records clips from the /demo page
 *
 * Uses the self-contained demo page with state switching controls.
 * Each clip is recorded by clicking the appropriate control button.
 *
 * Clips produced:
 *   01-registration.mp4       — founder sign-up form
 *   02-intake-form.mp4        — intake form walkthrough (83 Qs)
 *   03-personality-test.mp4   — personality test walkthrough (42 Qs)
 *   04-start-program.mp4      — rules & terms
 *   05-payment.mp4            — payment page
 *   06-dashboard-prework.mp4  — dashboard in prework state
 *   07-prework-form.mp4       — prework form sample
 *   08-dashboard-active.mp4   — active dashboard with timeline
 *   09-day2-form.mp4          — current day form (Day 2)
 *   10-previous-day.mp4       — viewing previous Day 1 submission
 *   11-mentor-review.mp4      — mentor review workflow
 *   12-gate-form.mp4          — gate review form (Day 15)
 */

const CONFIG = {
  baseUrl: process.env.DEMO_URL || 'http://localhost:3000',
  viewport: { width: 1920, height: 1080 },
  fps: 20,
  outputDir: path.resolve(__dirname, '../../video/public/demos'),
};

const FRAME_INTERVAL_MS = 1000 / CONFIG.fps;

// ─── Frame Capture ──────────────────────────────────────────────────────

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
    if (this.capturePromise) await this.capturePromise;
    return this.frameCount;
  }

  private async captureLoop() {
    while (this.capturing) {
      const start = Date.now();
      try {
        const buffer = await this.page.screenshot({ type: 'jpeg', quality: 95, timeout: 5000 });
        const framePath = path.join(this.framesDir, `frame_${String(this.frameCount).padStart(6, '0')}.jpg`);
        fs.writeFileSync(framePath, buffer);
        this.frameCount++;
      } catch {}
      const elapsed = Date.now() - start;
      const sleepMs = Math.max(0, FRAME_INTERVAL_MS - elapsed);
      if (sleepMs > 0) await new Promise(r => setTimeout(r, sleepMs));
    }
  }

  compileToMp4(outputPath: string) {
    console.log(`  Compiling ${this.frameCount} frames → MP4...`);
    execSync(
      `ffmpeg -y -framerate ${CONFIG.fps} -i "${this.framesDir}/frame_%06d.jpg" ` +
      `-c:v libx264 -crf 16 -preset medium -pix_fmt yuv420p -r 30 -movflags faststart ` +
      `"${outputPath}"`,
      { stdio: 'pipe' }
    );
    const durationSec = (this.frameCount / CONFIG.fps).toFixed(1);
    console.log(`  ✅ ${path.basename(outputPath)} (${this.frameCount} frames → ${durationSec}s)`);
  }

  cleanup() {
    fs.rmSync(this.framesDir, { recursive: true, force: true });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

async function wait(p: Page, ms: number) {
  await p.waitForTimeout(ms);
}

async function smoothScroll(p: Page, distance: number, durationMs = 2500) {
  const steps = Math.max(30, Math.floor(durationMs / 25));
  await p.evaluate(`(function(){
    var s=window.scrollY,d=${distance},n=${steps},i=0;
    function ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
    function step(){i++;window.scrollTo(0,s+d*ease(i/n));if(i<n)requestAnimationFrame(step)}
    requestAnimationFrame(step)
  })()`);
  await wait(p, durationMs + 200);
}

async function scrollToTop(p: Page) {
  await p.evaluate(`window.scrollTo({top:0,behavior:'smooth'})`);
  await wait(p, 1200);
}

async function scrollToBottom(p: Page) {
  await p.evaluate(`window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'})`);
  await wait(p, 1500);
}


async function injectCursor(p: Page) {
  try { if (await p.evaluate(`!!document.getElementById('pw-cursor')`)) return; } catch {}
  await p.addStyleTag({
    content: `*{cursor:none!important}.pw-cursor{position:fixed;width:22px;height:22px;background:radial-gradient(circle,rgba(11,157,247,.8) 0%,rgba(11,157,247,.15) 60%,transparent 100%);border:2px solid rgba(11,157,247,.95);border-radius:50%;pointer-events:none;z-index:999999;transform:translate(-50%,-50%);box-shadow:0 0 16px rgba(11,157,247,.5),0 0 4px rgba(11,157,247,.8)}`,
  });
  await p.evaluate(`(function(){var c=document.createElement('div');c.className='pw-cursor';c.id='pw-cursor';document.body.appendChild(c);document.addEventListener('mousemove',function(e){c.style.left=e.clientX+'px';c.style.top=e.clientY+'px'})})()`);
}

async function moveTo(p: Page, selector: string) {
  try {
    const box = await p.locator(selector).first().boundingBox();
    if (!box) return;
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 });
    await wait(p, 300);
  } catch {}
}

async function clickEl(p: Page, selector: string) {
  await moveTo(p, selector);
  await p.locator(selector).first().click();
  await wait(p, 500);
}

async function typeInto(p: Page, selector: string, text: string) {
  await moveTo(p, selector);
  await p.locator(selector).first().click();
  await p.locator(selector).first().pressSequentially(text, { delay: 55 });
  await wait(p, 400);
}

// Switch demo state by clicking the control bar button (match via title attribute)
async function switchTo(p: Page, label: string) {
  const btn = p.locator(`button[title^="${label}"]`).first();
  await btn.click();
  await wait(p, 2500);
  await p.evaluate(`window.scrollTo({top:0})`);
  await wait(p, 500);
}

// Hide the control bar for clean recording
async function hideControls(p: Page) {
  try {
    const closeBtn = p.locator('button[title="Hide controls (H)"]').first();
    if (await closeBtn.isVisible({ timeout: 1000 })) {
      await closeBtn.click();
      await wait(p, 300);
    }
  } catch {}
}

// Show the control bar
async function showControls(p: Page) {
  try {
    const hint = p.locator('text=press H').first();
    if (await hint.isVisible({ timeout: 1000 })) {
      await hint.click();
      await wait(p, 300);
    }
  } catch {}
}

// Record a clip
async function recordClip(
  p: Page,
  name: string,
  sceneFn: (p: Page) => Promise<void>,
) {
  console.log(`🎬 Recording: ${name}`);
  const framesDir = path.join(CONFIG.outputDir, `.frames-${name}`);
  const capture = new FrameCapture(p, framesDir);
  try {
    await hideControls(p);
    await capture.start();
    await sceneFn(p);
    await capture.stop();
    await showControls(p);
    capture.compileToMp4(path.join(CONFIG.outputDir, `${name}.mp4`));
  } catch (error) {
    await capture.stop();
    await showControls(p);
    console.error(`  ❌ "${name}" failed:`, error);
  }
  capture.cleanup();
}

// ─── MAIN ───────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  MESGA Demo — Recording from /demo page                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  fs.mkdirSync(CONFIG.outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: CONFIG.viewport, colorScheme: 'dark' });
  context.setDefaultTimeout(30000);
  const page = await context.newPage();

  // Navigate to demo page
  await page.goto(`${CONFIG.baseUrl}/demo`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await wait(page, 3000);
  try { await page.waitForLoadState('networkidle', { timeout: 10000 }); } catch {}

  // Focus the page so keyboard shortcuts work
  await page.locator('body').first().click();
  await wait(page, 500);

  // ═══════════════════════════════════════════════════════════════════════
  //  CLIP 1: Registration
  // ═══════════════════════════════════════════════════════════════════════
  await switchTo(page, 'Register');
  await recordClip(page, '01-registration', async (p) => {
    await injectCursor(p);
    await wait(p, 1500);

    // Click "Sign up" to show registration mode
    try { await clickEl(p, 'text=Sign up'); } catch {}
    await wait(p, 1000);

    // Type email
    await typeInto(p, '#email', 'test@mesga.eu');
    // Type password
    await typeInto(p, '#password', 'SecurePass123!');

    // Select founder role
    try {
      const roleSelect = p.locator('#role');
      if (await roleSelect.isVisible({ timeout: 1000 })) {
        await roleSelect.selectOption('founder');
        await wait(p, 500);
      }
    } catch {}

    await wait(p, 800);
    await moveTo(p, 'button:has-text("Create account")');
    await wait(p, 1500);
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  CLIP 2: Intake Form
  // ═══════════════════════════════════════════════════════════════════════
  await switchTo(page, 'Intake');
  await recordClip(page, '02-intake-form', async (p) => {
    await injectCursor(p);
    await wait(p, 2000);

    // Scroll through form, fill a few fields
    await smoothScroll(p, 500, 2500);
    await wait(p, 800);

    // Fill some dropdowns
    try {
      const selects = p.locator('select');
      const count = await selects.count();
      for (let i = 0; i < Math.min(count, 3); i++) {
        const sel = selects.nth(i);
        if (await sel.isVisible()) {
          await sel.scrollIntoViewIfNeeded();
          await wait(p, 300);
          const options = await sel.locator('option').allTextContents();
          if (options.length > 1) {
            await sel.selectOption({ index: 1 });
            await wait(p, 400);
          }
        }
      }
    } catch {}

    await smoothScroll(p, 600, 2500);
    await wait(p, 800);
    await smoothScroll(p, 600, 2500);
    await wait(p, 800);
    await smoothScroll(p, 500, 2500);
    await wait(p, 800);

    await scrollToBottom(p);
    await wait(p, 1000);
    await moveTo(p, 'button:has-text("Save")');
    await wait(p, 1500);
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  CLIP 3: Personality Test
  // ═══════════════════════════════════════════════════════════════════════
  await switchTo(page, 'PT');
  await recordClip(page, '03-personality-test', async (p) => {
    await injectCursor(p);
    await wait(p, 2000);

    // Click some personality scale buttons
    for (let batch = 0; batch < 5; batch++) {
      try {
        const btns = p.locator('button:not([type="submit"]):visible');
        const count = await btns.count();
        if (count === 0) break;
        for (let i = 0; i < Math.min(count, 5); i++) {
          try {
            const btn = btns.nth(i);
            const text = await btn.textContent();
            if (text && /^[1-7]$/.test(text.trim())) {
              await btn.click();
              await wait(p, 150);
            }
          } catch { break; }
        }
        await smoothScroll(p, 350, 1500);
        await wait(p, 500);
      } catch { break; }
    }

    await scrollToBottom(p);
    await wait(p, 800);
    await moveTo(p, 'button:has-text("Save")');
    await wait(p, 1500);
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  CLIP 4: Start Program
  // ═══════════════════════════════════════════════════════════════════════
  await switchTo(page, 'Start');
  await recordClip(page, '04-start-program', async (p) => {
    await injectCursor(p);
    await wait(p, 2500);

    await smoothScroll(p, 300, 2000);
    await wait(p, 1000);

    // Check checkboxes
    try {
      const checkboxes = p.locator('input[type="checkbox"]');
      const count = await checkboxes.count();
      for (let i = 0; i < count; i++) {
        const cb = checkboxes.nth(i);
        if (await cb.isVisible({ timeout: 2000 })) {
          await cb.scrollIntoViewIfNeeded();
          await wait(p, 500);
          await cb.click({ force: true });
          await wait(p, 600);
        }
      }
    } catch {}

    try {
      await moveTo(p, 'button:has-text("Agree")');
      await wait(p, 1200);
    } catch {}

    await wait(p, 1500);
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  CLIP 5: Payment
  // ═══════════════════════════════════════════════════════════════════════
  await switchTo(page, 'Payment');
  await recordClip(page, '05-payment', async (p) => {
    await injectCursor(p);
    await wait(p, 2500);

    await smoothScroll(p, 300, 2000);
    await wait(p, 2000);
    await smoothScroll(p, 200, 1500);
    await wait(p, 1500);
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  CLIP 6: Dashboard (Prework)
  // ═══════════════════════════════════════════════════════════════════════
  await switchTo(page, 'Prework');
  await recordClip(page, '06-dashboard-prework', async (p) => {
    await injectCursor(p);
    await wait(p, 2500);

    await smoothScroll(p, 400, 2500);
    await wait(p, 1200);
    await smoothScroll(p, 300, 2000);
    await wait(p, 1500);
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  CLIP 7: Prework Form
  // ═══════════════════════════════════════════════════════════════════════
  await switchTo(page, 'PW Form');
  await recordClip(page, '07-prework-form', async (p) => {
    await injectCursor(p);
    await wait(p, 2500);

    await smoothScroll(p, 500, 2500);
    await wait(p, 1200);
    await smoothScroll(p, 400, 2000);
    await wait(p, 1500);
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  CLIP 8: Dashboard (Active)
  // ═══════════════════════════════════════════════════════════════════════
  await switchTo(page, 'Active');
  await recordClip(page, '08-dashboard-active', async (p) => {
    await injectCursor(p);
    await wait(p, 2500);

    // Hide logout for cleaner look
    try { await p.addStyleTag({ content: 'form[action="/logout"]{opacity:0!important;visibility:hidden!important}' }); } catch {}

    // Scroll down through dashboard slowly
    await smoothScroll(p, 400, 2500);
    await wait(p, 1500);

    await smoothScroll(p, 400, 2500);
    await wait(p, 1500);

    // Scroll further through timeline
    await smoothScroll(p, 600, 2500);
    await wait(p, 1000);

    // Scroll to EU Space Data Integration section — it's below the timeline
    try {
      const spaceSection = p.locator('h3:has-text("EU Space Data Integration")');
      await spaceSection.scrollIntoViewIfNeeded({ timeout: 5000 });
      await wait(p, 2500);
    } catch {
      // Fallback: scroll all the way down
      await scrollToBottom(p);
      await wait(p, 2000);
    }

    // Pause on the EU Space Data Integration card — show Copernicus datasets & links
    await wait(p, 3000);

    // Scroll down more to show dataset details and external links
    await smoothScroll(p, 300, 2000);
    await wait(p, 2500);

    // Click the first Copernicus dataset link to show it navigates to real EU data
    try {
      // Remove target=_blank so link opens in same tab
      await p.evaluate(() => {
        document.querySelectorAll('a[target="_blank"]').forEach(a => a.removeAttribute('target'));
      });
      // Click the first dataset card link (the <a> wrapper around the dataset)
      const datasetLink = p.locator('a[href*="copernicus"]').first();
      if (await datasetLink.isVisible({ timeout: 2000 })) {
        await moveTo(p, 'a[href*="copernicus"]');
        await wait(p, 800);
        await datasetLink.click();
        await wait(p, 6000);
        // Scroll the Copernicus page
        await smoothScroll(p, 300, 2000);
        await wait(p, 2000);
      }
    } catch {}

    await wait(p, 1500);
  });

  // Navigate back to demo page after Copernicus redirect
  await page.goto(`${CONFIG.baseUrl}/demo`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await wait(page, 3000);
  try { await page.waitForLoadState('networkidle', { timeout: 10000 }); } catch {}
  await page.locator('body').first().click();
  await wait(page, 500);

  // ═══════════════════════════════════════════════════════════════════════
  //  CLIP 9: Day 2 Form
  // ═══════════════════════════════════════════════════════════════════════
  await switchTo(page, 'Day 2');
  await recordClip(page, '09-day2-form', async (p) => {
    await injectCursor(p);
    await wait(p, 2500);

    try { await p.addStyleTag({ content: 'form[action="/logout"]{opacity:0!important;visibility:hidden!important}' }); } catch {}

    await smoothScroll(p, 500, 2500);
    await wait(p, 1000);

    // Fill in some fields
    try {
      const textInputs = p.locator('textarea, input[type="text"], input[type="url"]');
      const count = await textInputs.count();
      const samples = [
        'Analyzed data for agricultural region',
        'https://mesga.eu/prototype',
      ];
      for (let i = 0; i < Math.min(count, 2); i++) {
        const input = textInputs.nth(i);
        if (await input.isVisible()) {
          await input.scrollIntoViewIfNeeded();
          await wait(p, 300);
          await input.click();
          await input.pressSequentially(samples[i] || 'Demo answer', { delay: 45 });
          await wait(p, 500);
        }
      }
    } catch {}

    await smoothScroll(p, 400, 2000);
    await wait(p, 1000);
    await scrollToBottom(p);
    await wait(p, 800);

    await moveTo(p, 'button:has-text("Save"), button[type="submit"]');
    await wait(p, 1500);
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  CLIP 10: Previous Day (Day 1)
  // ═══════════════════════════════════════════════════════════════════════
  await switchTo(page, 'Prev Day');
  await recordClip(page, '10-previous-day', async (p) => {
    await injectCursor(p);
    await wait(p, 2500);

    try { await p.addStyleTag({ content: 'form[action="/logout"]{opacity:0!important;visibility:hidden!important}' }); } catch {}

    await smoothScroll(p, 500, 2500);
    await wait(p, 1200);
    await smoothScroll(p, 400, 2000);
    await wait(p, 1500);
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  CLIP 11: Mentor Review
  // ═══════════════════════════════════════════════════════════════════════
  await switchTo(page, 'Mentor');
  await recordClip(page, '11-mentor-review', async (p) => {
    await injectCursor(p);
    await wait(p, 2500);

    // Click Review button on first submission card in Inbox (NOT Gate Reviews tab)
    try {
      const reviewBtn = p.locator('button.bg-white:has-text("Review")').first();
      if (await reviewBtn.isVisible({ timeout: 3000 })) {
        await reviewBtn.click();
        await wait(p, 2000);

        // Score stars
        try {
          const starBtns = p.locator('button:has-text("★")');
          if (await starBtns.count() >= 5) {
            await starBtns.nth(4).click();
            await wait(p, 800);
          }
        } catch {}

        // Fill feedback
        try {
          const textarea = p.locator('textarea').first();
          if (await textarea.isVisible()) {
            await textarea.click();
            await textarea.pressSequentially(
              'Great progress! The initial market analysis looks solid.',
              { delay: 40 }
            );
            await wait(p, 1000);
          }
        } catch {}

        try {
          await moveTo(p, 'button:has-text("Submit Review")');
          await wait(p, 1200);
        } catch {}
      }
    } catch {}

    await smoothScroll(p, 300, 2000);
    await wait(p, 1500);
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  CLIP 12: Gate Form
  // ═══════════════════════════════════════════════════════════════════════
  await switchTo(page, 'Gate');
  await recordClip(page, '12-gate-form', async (p) => {
    await injectCursor(p);
    await wait(p, 2500);

    try { await p.addStyleTag({ content: 'form[action="/logout"]{opacity:0!important;visibility:hidden!important}' }); } catch {}

    await smoothScroll(p, 500, 2500);
    await wait(p, 1200);
    await smoothScroll(p, 400, 2500);
    await wait(p, 1200);
    await scrollToTop(p);
    await wait(p, 1500);
  });

  // ─── Done ─────────────────────────────────────────────────────────────
  await context.close();
  await browser.close();

  console.log('');
  console.log('✅ All clips recorded!');
  console.log('');

  const files = fs.readdirSync(CONFIG.outputDir).filter(f => f.endsWith('.mp4')).sort();
  console.log('Output clips:');
  for (const f of files) {
    const stat = fs.statSync(path.join(CONFIG.outputDir, f));
    console.log(`  ${f} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
  }

  console.log('');
  console.log('Next steps:');
  console.log('  cd video && pnpm studio   (preview)');
  console.log('  cd video && pnpm render   (render final MP4)');
}

main().catch(console.error);
