// Screen recorder for the demo video.
// - Frames come from Chrome's screencast (JPEG q92) rather than Playwright's built-in video, which is too soft
//   for text-heavy screens. Frames arrive only when the screen changes; ffmpeg holds each one until the next.
// - A visible cursor (arrow + click ripple) is injected into every page, so it is part of the real footage.
// - Every move, click, keystroke and "result" marker is logged with its time and element box. The Remotion
//   edit uses that log for zooms, spotlights, callouts and sound effects, so overlays line up with real events.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const VIEWPORT = { width: 1600, height: 900 };
export const SCALE = 1.2; // 1600×900 CSS px → 1920×1080 frames, text stays crisp and readable

const CURSOR_SCRIPT = `(() => {
  if (window.__demoCursor) return; window.__demoCursor = true;
  const install = () => {
    const c = document.createElement('div');
    c.id = '__demo_cursor';
    c.style.cssText = 'position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;translate:-200px -200px;';
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2 L3 21 L8.5 16 L12 24 L15.5 22.5 L12 15 L19.5 15 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.translate = (e.clientX - 3) + 'px ' + (e.clientY - 2) + 'px'; }, true);
    addEventListener('mousedown', (e) => {
      const r = document.createElement('div');
      r.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border-radius:50%;border:3px solid rgba(37,99,235,.9);background:rgba(37,99,235,.18);width:16px;height:16px;left:' + (e.clientX - 8) + 'px;top:' + (e.clientY - 8) + 'px;transition:all .45s ease-out;opacity:1';
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.width = r.style.height = '56px'; r.style.left = (e.clientX - 28) + 'px'; r.style.top = (e.clientY - 28) + 'px'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 600);
    }, true);
  };
  if (document.documentElement) install(); else addEventListener('DOMContentLoaded', install);
})();`;

export async function newPage(browser, { token, prefs } = {}) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
  await ctx.addInitScript(CURSOR_SCRIPT);
  await ctx.addInitScript(
    ([tok, pr]) => {
      if (tok) sessionStorage.setItem('aicte.token', tok);
      try {
        if (pr && !sessionStorage.getItem('__prefs_set')) {
          localStorage.setItem('approvalsetu.prefs', JSON.stringify(pr));
          sessionStorage.setItem('__prefs_set', '1');
        }
      } catch {}
    },
    [token ?? null, prefs ?? { lang: 'en', textSize: 'md', contrast: false }],
  );
  const page = await ctx.newPage();
  page.__mouse = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };
  return page;
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Recorder {
  constructor(outDir, name, timings) {
    this.timings = timings;
    this.dir = path.join(outDir, name);
    this.name = name;
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(path.join(this.dir, 'frames'), { recursive: true });
    this.frames = [];
    this.events = [];
    this.page = null;
  }

  now() {
    return Date.now() / 1000;
  }

  log(type, data = {}) {
    this.events.push({ t: this.now(), type, ...data });
  }

  async attach(page) {
    if (this.cdp) await this.detach();
    this.page = page;
    this.cdp = await page.context().newCDPSession(page);
    this.cdp.on('Page.screencastFrame', async (f) => {
      const i = this.frames.length;
      const file = `f${String(i).padStart(6, '0')}.jpg`;
      fs.writeFileSync(path.join(this.dir, 'frames', file), Buffer.from(f.data, 'base64'));
      this.frames.push({ file, t: f.metadata.timestamp });
      await this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
    this.log('attach');
  }

  async detach() {
    if (!this.cdp) return;
    await this.cdp.send('Page.stopScreencast').catch(() => {});
    await this.cdp.detach().catch(() => {});
    this.cdp = null;
  }

  // ---- actions (all logged) -------------------------------------------------------------------------------

  async box(locator) {
    await locator.waitFor({ state: 'visible', timeout: 30000 });
    await locator.scrollIntoViewIfNeeded();
    const b = await locator.boundingBox();
    if (!b) throw new Error('no bounding box');
    return b;
  }

  async moveTo(x, y, ms = 650) {
    const p = this.page;
    const from = { ...p.__mouse };
    const steps = Math.max(8, Math.round(ms / 16));
    for (let i = 1; i <= steps; i++) {
      const k = ease(i / steps);
      await p.mouse.move(from.x + (x - from.x) * k, from.y + (y - from.y) * k);
      await sleep(ms / steps);
    }
    p.__mouse = { x, y };
  }

  async hover(locator, label) {
    const b = await this.box(locator);
    await this.moveTo(b.x + b.width / 2, b.y + b.height / 2);
    this.log('hover', { label, box: b });
    return b;
  }

  async click(locator, label, { pauseBefore = 280, pauseAfter = 450 } = {}) {
    const b = await this.hover(locator, label);
    await sleep(pauseBefore);
    this.log('click', { label, box: b, x: b.x + b.width / 2, y: b.y + b.height / 2 });
    await this.page.mouse.down();
    await sleep(70);
    await this.page.mouse.up();
    await sleep(pauseAfter);
    return b;
  }

  async type(locator, text, label, { delay = 65, clear = true } = {}) {
    const b = await this.click(locator, label, { pauseAfter: 150 });
    if (clear) {
      await locator.fill('');
    }
    this.log('typeStart', { label, box: b, text });
    for (const ch of text) {
      await this.page.keyboard.type(ch);
      this.log('key');
      await sleep(delay + Math.random() * 35);
    }
    this.log('typeEnd', { label, box: b });
    await sleep(300);
  }

  async select(locator, option, label) {
    const b = await this.click(locator, label, { pauseAfter: 200 });
    await locator.selectOption(option);
    this.log('select', { label, box: b });
    await this.page.keyboard.press('Escape').catch(() => {});
    await sleep(400);
  }

  async upload(locator, file, label, target) {
    const b = target ? await this.click(target, label) : await this.box(locator);
    await locator.setInputFiles(file);
    this.log('upload', { label, box: b, file: path.basename(file) });
    await sleep(500);
  }

  /** A verified outcome on screen: the edit zooms to it and shows a callout. */
  async result(locator, label) {
    const b = await this.box(locator);
    this.log('result', { label, box: b });
    return b;
  }

  async mark(label) {
    this.log('mark', { label });
  }

  /** Narration cue. Waits until the previous line has finished, logs the cue (the edit starts that line's audio
   *  here) and returns while the voice plays, so the actions that follow happen as it is spoken.
   *  With wait: true it also waits until this line has finished. */
  async say(id, { wait = false, gap = 0.25 } = {}) {
    const d = this.timings?.[id]?.duration;
    if (d == null) throw new Error(`no narration timing for ${id}`);
    const left = (this.voiceEnd ?? 0) - this.now();
    if (left > 0) await sleep(left * 1000);
    this.log('say', { id, duration: d });
    this.voiceEnd = this.now() + d + gap;
    if (wait) await sleep((d + gap) * 1000);
  }

  /** Wait until the current narration line has finished. */
  async quiet(extra = 0) {
    const left = (this.voiceEnd ?? 0) - this.now() + extra;
    if (left > 0) await sleep(left * 1000);
  }

  async hold(ms) {
    await sleep(ms);
  }

  // ---- output ----------------------------------------------------------------------------------------------

  /** Write <name>.mp4 (30 fps, constant rate) and <name>.events.json with times relative to the video start. */
  async finish() {
    await this.quiet(0.8);
    await this.detach();
    if (!this.frames.length) throw new Error(`${this.name}: no frames captured`);
    const t0 = this.frames[0].t;
    const end = Math.max(this.frames.at(-1).t + 0.5, this.now());
    const lines = [];
    this.frames.forEach((f, i) => {
      const next = i + 1 < this.frames.length ? this.frames[i + 1].t : end;
      lines.push(`file 'frames/${f.file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
    });
    lines.push(`file 'frames/${this.frames.at(-1).file}'`);
    fs.writeFileSync(path.join(this.dir, 'frames.txt'), lines.join('\n'));
    const mp4 = path.join(this.dir, `${this.name}.mp4`);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'frames.txt', '-vf', 'fps=30,scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-movflags', '+faststart', mp4], { cwd: this.dir });
    const events = this.events.map((e) => ({ ...e, t: +(e.t - t0).toFixed(3) }));
    const duration = +(end - t0).toFixed(3);
    fs.writeFileSync(path.join(this.dir, `${this.name}.events.json`), JSON.stringify({ name: this.name, duration, scale: SCALE, viewport: VIEWPORT, events }, null, 1));
    fs.rmSync(path.join(this.dir, 'frames'), { recursive: true, force: true });
    fs.rmSync(path.join(this.dir, 'frames.txt'), { force: true });
    return { mp4, duration };
  }
}
