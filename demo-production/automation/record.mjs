// Records every chapter of the demo video from the real app, in order, after a fresh `npm run demo:reset`.
// Usage: node record.mjs [fromChapter]   (BASE defaults to the local dev server)
// Each chapter writes recordings/<ch>/<ch>.mp4 and <ch>.events.json. Narration cues (say) use the generated
// line durations, so the actions on screen happen while the matching sentence is spoken.
// Every step asserts the real outcome (text on screen or API state); a failed assertion stops the recording.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Recorder, newPage } from './lib/recorder.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const prod = path.resolve(here, '..');
const repo = path.resolve(prod, '..');
const BASE = process.env.BASE ?? 'http://localhost:5173';
const API = process.env.API ?? 'http://localhost:4000/api';
const OUT = path.join(prod, 'recordings');
const FILES = path.join(here, 'files');
const timings = JSON.parse(fs.readFileSync(path.join(prod, 'narration/audio/timings.json'), 'utf8'));
const statePath = path.join(OUT, 'state.json');
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
const save = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 1));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (m) => {
  throw new Error(m);
};
const ok = (m) => console.log(`  ✓ ${m}`);

async function token(email) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'demo1234' }) });
  const j = await r.json();
  if (!r.ok) fail(`${email}: ${j.error}`);
  return j.token;
}
async function call(tok, method, p, body) {
  const r = await fetch(API + p, { method, headers: { Authorization: `Bearer ${tok}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => null);
  if (!r.ok) fail(`${method} ${p}: ${r.status} ${j?.error}`);
  return j;
}
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const today = async () => (await call(await token('admin@demo.in'), 'GET', '/demo/clock')).today;

let browser;
async function pageAs(email, url) {
  const p = await newPage(browser, { token: email ? await token(email) : null });
  await p.goto(BASE + url);
  await p.waitForLoadState('networkidle');
  await sleep(500);
  return p;
}

const chapters = {
  async ch1(rec) {
    const p = await pageAs(null, '/');
    await p.waitForSelector('text=Recent changes');
    await rec.attach(p);
    await rec.hold(900);
    const sizes = p.locator('[role=group][aria-label="Text size"] button');
    await rec.say('ch1.b1');
    await rec.click(sizes.nth(2), 'Larger text (A+)');
    await rec.result(p.locator('main h1').first(), 'Text is larger');
    await rec.hold(800);
    await rec.say('ch1.b2');
    await rec.click(p.locator('button[lang=hi]'), 'हिंदी');
    await p.waitForSelector('text=एआईसीटीई');
    await rec.result(p.locator('header').first(), 'Whole site in Hindi');
    await rec.hold(800);
    await rec.say('ch1.b3');
    await rec.click(p.locator('ul[aria-label] > li > button[aria-pressed]'), 'High contrast');
    await rec.result(p.locator('main').first(), 'High-contrast mode');
    await rec.quiet(1.2);
    await rec.mark('end');
    // Back to the defaults for the next chapters (after the cut).
    await p.locator('ul[aria-label] > li > button[aria-pressed]').click();
    await p.locator('button[lang=en]').click();
    await sizes.nth(1).click();
    ok('portal: larger text, Hindi, high contrast');
  },

  async ch2(rec) {
    const t0 = await today();
    const p = await pageAs(null, '/');
    await rec.attach(p);
    await rec.hold(600);
    await rec.click(p.locator('button:has-text("college.abc@demo.in")'), 'Demo user: ABC Engineering College');
    await rec.click(p.getByRole('button', { name: 'Sign in' }), 'Sign in');
    await p.waitForURL((u) => u.pathname.startsWith('/college'));
    await p.waitForLoadState('networkidle');
    await rec.click(p.getByRole('link', { name: 'New application' }).first(), 'New application');
    await p.waitForSelector('text=Filing under approval cycle');
    await rec.say('ch2.b1');
    await rec.result(p.locator('text=Filing under approval cycle').first(), 'Cycle and rules version');
    await rec.quiet();
    await rec.click(p.getByRole('button', { name: 'Continue' }), 'Continue');
    await rec.say('ch2.b2');
    await rec.type(p.locator('#land'), '5000', 'Land area (sq m)');
    await rec.type(p.locator('#built'), '9000', 'Built-up area (sq m)');
    await rec.click(p.locator('#leaseExpiry'), 'Lease expiry');
    await p.fill('#leaseExpiry', addDays(t0, 730));
    await rec.click(p.getByRole('button', { name: 'Continue' }), 'Continue');
    await p.waitForSelector('text=Built-up area is larger than the plot');
    await rec.say('ch2.b3');
    await rec.result(p.locator('text=Built-up area is larger than the plot').first(), 'Advice, not a block');
    await rec.hold(1500);
    await rec.click(p.getByRole('button', { name: 'Back' }), 'Back');
    await rec.type(p.locator('#built'), '4000', 'Corrected built-up area');
    await rec.quiet();
    await rec.click(p.getByRole('button', { name: 'Continue' }), 'Continue');
    await rec.type(p.locator('input[placeholder="B.Tech Computer Science"]'), 'B.Tech Computer Science', 'Programme', { delay: 40 });
    await rec.type(p.locator('#course-0-intake'), '120', 'Intake');
    await rec.type(p.locator('#faculty'), '30', 'Faculty');
    await rec.type(p.locator('#labs'), '8', 'Laboratories');
    await rec.click(p.getByRole('button', { name: 'Continue' }), 'Continue');
    await rec.upload(p.locator('#doc-BUILDING_PLAN'), path.join(FILES, 'plan.pdf'), 'Building plan', p.locator('#doc-BUILDING_PLAN'));
    await rec.upload(p.locator('#doc-AFFIDAVIT'), path.join(FILES, 'affidavit.pdf'), 'Affidavit', p.locator('#doc-AFFIDAVIT'));
    await rec.click(p.getByRole('button', { name: 'Continue' }), 'Continue');
    await p.waitForSelector('li:has-text("Land lease or title deed")');
    const submit = p.getByRole('button', { name: 'Submit application' });
    if (!(await submit.isDisabled())) fail('submit not blocked');
    await rec.say('ch2.b4');
    await rec.result(p.locator('li:has-text("Land lease or title deed")').first(), 'Blocked: names the missing document');
    await rec.hover(submit, 'Submit is disabled');
    await rec.quiet(0.4);
    await rec.click(p.getByRole('button', { name: 'Back' }), 'Back');
    await rec.upload(p.locator('#doc-LAND_LEASE'), path.join(FILES, 'lease2.pdf'), 'Land lease', p.locator('#doc-LAND_LEASE'));
    await rec.click(p.locator('#doc-LAND_LEASE-expiry'), 'Lease expiry');
    await p.fill('#doc-LAND_LEASE-expiry', addDays(t0, 730));
    await rec.say('ch2.b5');
    await rec.click(p.getByRole('button', { name: 'Continue' }), 'Continue');
    await sleep(1200);
    if (await p.isVisible('#justification')) await rec.type(p.locator('#justification'), 'Figures checked against the approved plan.', 'Justification', { delay: 35 });
    await rec.click(p.getByRole('button', { name: 'Submit application' }), 'Submit application');
    await p.waitForURL(/\/college\/applications\//);
    await p.waitForLoadState('networkidle');
    state.appId = p.url().split('/').pop();
    state.appNo = (await p.textContent('h1')).trim();
    save();
    await rec.say('ch2.c');
    await rec.result(p.locator('h1'), `Submitted: ${state.appNo}`);
    await rec.quiet(1);
    await rec.mark('end');
    ok(`submitted ${state.appNo}`);
  },

  async ch3(rec) {
    const p = await pageAs('priya@demo.in', '/officer');
    await rec.attach(p);
    await rec.say('ch3.b');
    await rec.click(p.getByRole('tab', { name: /My tasks/ }), 'My tasks');
    await rec.click(p.getByRole('row', { name: new RegExp(state.appNo) }), state.appNo);
    await p.waitForSelector('p:has-text("Assigned because")');
    const why = (await p.textContent('p:has-text("Assigned because")')).trim();
    if (!/Priya Raman .*portfolio officer for ABC Engineering College/.test(why)) fail('assignment reason: ' + why);
    await rec.say('ch3.c');
    await rec.result(p.locator('p:has-text("Assigned because")'), 'Why this officer');
    await rec.quiet(1);
    await rec.mark('end');
    ok('assignment reason shown');
  },

  async ch4(rec) {
    let p = await pageAs('priya@demo.in', `/cases/${state.appId}`);
    await p.waitForSelector('p:has-text("Assigned because")');
    await rec.attach(p);
    await rec.say('ch4.b1');
    await rec.click(p.getByRole('button', { name: 'Return to college' }).first(), 'Return to college');
    const d = p.getByRole('dialog');
    await rec.click(d.getByLabel('Land lease or title deed'), 'Land lease or title deed');
    await rec.type(d.getByLabel('Reason'), 'Lease covers 2 years, 3 required', 'Reason', { delay: 40 });
    await rec.click(d.getByRole('button', { name: 'Return to college' }), 'Return to college');
    await p.waitForSelector('text=Waiting on college');
    await rec.say('ch4.b2');
    await rec.result(p.locator('text=Waiting on college').first(), 'Clock paused: waiting on college');
    await rec.quiet(0.6);
    const t0 = await today();
    const c = await pageAs('college.abc@demo.in', `/college/applications/${state.appId}`);
    await rec.attach(c);
    await p.context().close();
    await rec.say('ch4.b3');
    await rec.upload(c.locator('input[type=file]').first(), path.join(FILES, 'lease3.pdf'), 'Renewed lease (3 years)', c.locator('input[type=file]').first());
    await rec.click(c.getByLabel('Expiry date of the new document'), 'Expiry date');
    await c.getByLabel('Expiry date of the new document').fill(addDays(t0, 1095));
    await rec.type(c.getByLabel('Reply note'), 'Attached the renewed lease valid for 3 years.', 'Reply note', { delay: 30 });
    await rec.click(c.getByRole('button', { name: 'Send reply' }), 'Send reply');
    await c.waitForSelector('text=Reply sent');
    await rec.result(c.locator('text=Reply sent').first(), 'Reply sent');
    await rec.quiet(0.3);
    p = await pageAs('priya@demo.in', `/cases/${state.appId}`);
    await p.waitForSelector('p:has-text("Assigned because")');
    if (!/continuity/.test(await p.textContent('p:has-text("Assigned because")'))) fail('re-scrutiny not continuity');
    await rec.attach(p);
    await c.context().close();
    await rec.say('ch4.c');
    await rec.result(p.locator('p:has-text("With:")').first(), 'Back with Priya, remaining days');
    await rec.quiet(1);
    await rec.mark('end');
    // Off camera: Priya completes scrutiny so the case moves to the expert visit (needed by chapter 5).
    await p.getByRole('button', { name: 'Complete scrutiny' }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Complete scrutiny' }).click();
    await p.waitForSelector('text=Ravi Kumar');
    ok('returned, replied, back with Priya; scrutiny completed');
  },

  async ch5(rec) {
    const p = await pageAs('admin@demo.in', '/admin');
    await p.waitForSelector('text=Custom number of days');
    await rec.attach(p);
    await rec.say('ch5.b');
    await rec.type(p.getByLabel('Custom number of days'), '20', 'Days to advance');
    await rec.click(p.getByRole('button', { name: 'Advance', exact: true }), 'Advance');
    await p.waitForSelector('text=New simulated date');
    await rec.result(p.locator('text=New simulated date').first(), 'Simulated date moved +20 days');
    await rec.quiet(0.3);
    const k = await pageAs('kumar@demo.in', '/team');
    await k.waitForSelector('text=Direct reports');
    await sleep(800);
    if (!(await k.isVisible(`text=${state.appNo}`))) fail('not in Escalated to me');
    await rec.attach(k);
    await p.context().close();
    await rec.say('ch5.c');
    await rec.result(k.locator(`text=${state.appNo}`).first(), 'Escalated to Kumar, once');
    await rec.quiet(1);
    await rec.mark('end');
    ok('escalated to Kumar');
  },

  async ch6(rec) {
    const p = await pageAs('kumar@demo.in', '/availability');
    await rec.attach(p);
    await rec.say('ch6.b1');
    await rec.select(p.getByLabel('Team member'), { label: 'Arjun Rao (Officer)' }, 'Arjun Rao');
    await rec.type(p.getByLabel('Reason'), 'Medical leave', 'Reason');
    const from = await p.inputValue('input[type=date] >> nth=0');
    await rec.click(p.locator('input[type=date]').nth(1), 'Leave ends');
    await p.locator('input[type=date]').nth(1).fill(addDays(from, 7));
    await rec.click(p.getByRole('button', { name: 'Add period' }), 'Add period');
    await rec.click(p.getByRole('dialog').getByRole('button', { name: 'Add period and reassign' }), 'Add period and reassign');
    await p.waitForSelector('text=Tasks reassigned');
    await rec.result(p.locator('section:has(h2:text("Tasks reassigned"))'), 'Tasks reassigned, each with a reason');
    await rec.quiet(0.6);
    await p.goto(BASE + '/workforce');
    await p.waitForLoadState('networkidle');
    await rec.say('ch6.b2');
    await rec.click(p.getByRole('row', { name: /Meena Pillai/ }), 'Meena Pillai');
    await rec.click(p.getByRole('button', { name: 'Reassign' }).first(), 'Reassign');
    await p.waitForSelector('text=Recommended by system');
    await rec.result(p.locator('text=Recommended by system').first(), 'Recommended by system');
    const sel = p.getByRole('dialog').getByLabel('Reassign to');
    await rec.select(sel, await sel.evaluate((s) => [...s.options].find((o) => o.value && !o.disabled)?.value), 'Reassign to');
    await rec.type(p.getByRole('dialog').getByLabel('Reason'), 'Spreading work in the team', 'Reason', { delay: 35 });
    await rec.click(p.getByRole('dialog').getByRole('button', { name: 'Reassign task' }), 'Reassign task');
    await p.waitForSelector('[role=status]:has-text("reassigned")');
    await rec.result(p.locator('[role=status]:has-text("reassigned")').first(), 'Recorded');
    await rec.quiet(1);
    await rec.mark('end');
    ok('leave reassignment and manual reassignment');
  },

  async ch7(rec) {
    let p = await pageAs('ravi@demo.in', '/evc');
    await rec.attach(p);
    await rec.say('ch7.b1');
    await rec.click(p.getByRole('row', { name: new RegExp(state.appNo) }), state.appNo);
    await rec.click(p.getByRole('button', { name: 'Schedule EVC visit' }), 'Schedule EVC visit');
    await p.waitForSelector('text=Proposed by the system');
    await rec.result(p.locator('text=Proposed by the system').first(), 'Committee proposed by the system');
    const member1 = await p.getByRole('dialog').getByLabel('Member 1').evaluate((s) => s.options[s.selectedIndex].text);
    await rec.hold(900);
    await rec.click(p.getByRole('dialog').getByRole('button', { name: 'Schedule visit' }), 'Schedule visit');
    await p.waitForSelector('text=has moved on from your desk');
    await rec.quiet(0.2);
    await call(await token('admin@demo.in'), 'POST', '/demo/advance-time', { days: 1 });
    const n = { 'Prof. N. Raghunathan': 1, 'Dr. Shobha Hegde': 2, 'Prof. Imran Sheikh': 3, 'Dr. Usha Rani': 4, 'Prof. Devendra Tiwari': 5, 'Dr. Asha Varghese': 6 }[member1];
    const m = await pageAs(`committee${n}@demo.in`, `/cases/${state.appId}`);
    await rec.attach(m);
    await p.context().close();
    await rec.say('ch7.b2');
    await rec.click(m.getByRole('button', { name: 'Submit EVC report' }), 'Submit EVC report');
    const d = m.getByRole('dialog');
    for (const l of ['Land and buildings match the application', 'Laboratories and equipment are in place', 'Faculty are in position as stated', 'Library and learning resources are adequate']) await rec.click(d.getByLabel(l), l, { pauseBefore: 120, pauseAfter: 150 });
    await rec.select(d.getByLabel('Recommendation'), 'RECOMMEND_CONDITIONS', 'Recommend with conditions');
    await rec.type(d.getByLabel('Report'), 'Facilities match; fire NOC pending.', 'Report', { delay: 35 });
    await rec.click(d.getByRole('button', { name: 'Submit report' }), 'Submit report');
    await m.waitForSelector('text=Competent authority, South');
    const t8 = await today();
    const a = await pageAs('authority.south@demo.in', `/cases/${state.appId}`);
    await rec.attach(a);
    await m.context().close();
    await rec.say('ch7.b3');
    await rec.click(a.getByRole('button', { name: 'Record decision' }), 'Record decision');
    const dd = a.getByRole('dialog');
    await rec.click(dd.getByRole('radio', { name: 'Approve with conditions' }), 'Approve with conditions');
    await rec.type(dd.getByRole('textbox', { name: 'Condition 1', exact: true }), 'Submit fire NOC', 'Condition', { delay: 45 });
    await rec.click(dd.getByLabel('Due date'), 'Due date');
    await dd.getByLabel('Due date').fill(addDays(t8, 90));
    await rec.type(dd.getByLabel('Reason'), 'Meets the norms subject to the fire NOC.', 'Reason', { delay: 30 });
    await rec.click(dd.getByRole('button', { name: 'Approve with conditions' }).last(), 'Approve with conditions');
    await a.waitForSelector('text=Approved with conditions');
    await rec.result(a.locator('text=Approved with conditions').first(), 'Approved with conditions');
    await rec.quiet(0.2);
    await call(await token('admin@demo.in'), 'POST', '/demo/advance-time', { days: 85 });
    const c = await pageAs('college.abc@demo.in', '/college/compliance');
    await rec.attach(c);
    await a.context().close();
    await rec.say('ch7.b4');
    const row = c.getByRole('row', { name: /Submit fire NOC/ });
    await rec.click(row.getByRole('button', { name: 'Upload evidence' }), 'Upload evidence');
    await rec.upload(c.locator('input[type=file]'), path.join(FILES, 'firenoc.pdf'), 'Fire NOC', c.getByRole('dialog'));
    await rec.click(c.getByRole('dialog').getByRole('button', { name: 'Upload evidence' }), 'Upload evidence');
    await c.waitForSelector('text=Waiting for verification');
    await rec.result(c.locator('text=Waiting for verification').first(), 'Waiting for verification');
    const pv = await pageAs('priya@demo.in', `/cases/${state.appId}`);
    await rec.attach(pv);
    await c.context().close();
    await rec.click(pv.getByRole('button', { name: 'Verify', exact: true }), 'Verify');
    const pr = await token('priya@demo.in');
    for (let i = 0; i < 20; i++) {
      if ((await call(pr, 'GET', `/applications/${state.appId}`)).application.status === 'CLOSED') break;
      await sleep(700);
    }
    if ((await call(pr, 'GET', `/applications/${state.appId}`)).application.status !== 'CLOSED') fail('not closed');
    await pv.reload();
    await pv.waitForLoadState('networkidle');
    await rec.say('ch7.c');
    await rec.result(pv.getByText('Closed', { exact: true }).first(), 'Case closed');
    await rec.quiet(1);
    await rec.mark('end');
    ok('visit, report, decision, evidence, verified, closed');
  },

  async ch8(rec) {
    const ed = await pageAs('rules.editor@demo.in', '/rules');
    await rec.attach(ed);
    await rec.say('ch8.b1');
    await rec.click(ed.locator('button:has-text("Draft an amendment")'), 'Draft an amendment');
    await rec.select(ed.getByLabel('Source'), 'CORRIGENDUM', 'Source: corrigendum');
    await rec.type(ed.getByLabel('Reference number'), 'PROTOTYPE/CORR/2027-28/1', 'Reference', { delay: 30 });
    await rec.type(ed.getByLabel('Title'), 'Corrigendum (prototype)', 'Title', { delay: 30 });
    await ed.getByLabel('Summary for colleges').fill('New institutions must attach a fire safety audit report. The 2027–28 application window is extended by 14 days for everyone.');
    await rec.hover(ed.getByLabel('Summary for colleges'), 'Summary for colleges');
    await rec.click(ed.locator('[role=dialog] button:has-text("Create draft")'), 'Create draft');
    await ed.waitForURL(/\/rules\/versions\/[0-9a-f-]+$/);
    state.vid = ed.url().split('/').pop();
    save();
    await rec.click(ed.locator('nav[aria-label=Sections] button:has-text("Documents")'), 'Documents');
    await rec.click(ed.locator('button:has-text("Add a document")'), 'Add a document');
    await rec.type(ed.getByLabel('Kind').last(), 'FIRE_SAFETY_AUDIT', 'Kind', { delay: 30 });
    await rec.type(ed.getByLabel('Label').last(), 'Fire safety audit report', 'Label', { delay: 30 });
    await rec.click(ed.getByLabel('Fire safety audit report critical'), 'Critical');
    await rec.click(ed.locator('nav[aria-label=Sections] button:has-text("Schedule")'), 'Schedule');
    const to = ed.getByLabel('To', { exact: true }).first();
    const old = await to.inputValue();
    await rec.click(to, 'Window closes');
    await to.fill(addDays(old, 14));
    await rec.click(ed.locator('button:has-text("Save draft")'), 'Save draft');
    await ed.waitForSelector('text=Saved');
    await ed.waitForSelector('select[aria-label^="Apply scope of documents.FIRE_SAFETY_AUDIT"]');
    await rec.say('ch8.b2');
    await rec.select(ed.locator('select[aria-label^="Apply scope of documents.FIRE_SAFETY_AUDIT"]'), 'LIVE', 'Apply to: live cases');
    await ed.selectOption('select[aria-label="Apply scope of schedule.window-main"]', 'LIVE');
    await rec.click(ed.locator('button:has-text("Save amendment")'), 'Save amendment');
    await ed.waitForSelector('text=Amendment saved');
    await rec.click(ed.locator('button:has-text("Submit for review")'), 'Submit for review');
    await rec.click(ed.locator('[role=dialog] button:has-text("Submit for review")'), 'Submit for review');
    await ed.waitForSelector('[role=dialog] [role=alert]');
    const msg = await ed.locator('[role=dialog] [role=alert]').innerText();
    if (!/can only apply to new cases/.test(msg)) fail('unexpected: ' + msg);
    await rec.result(ed.locator('[role=dialog] [role=alert]'), 'Refused: only for new cases');
    await rec.quiet(0.5);
    await rec.click(ed.locator('[role=dialog] button:has-text("Cancel")'), 'Cancel');
    await rec.select(ed.locator('select[aria-label^="Apply scope of documents.FIRE_SAFETY_AUDIT"]'), 'NEW_CASES', 'Apply to: new cases');
    await rec.click(ed.locator('button:has-text("Save amendment")'), 'Save amendment');
    await ed.waitForSelector('text=Amendment saved');
    await ed.goto(`${BASE}/rules/versions/${state.vid}/impact`);
    await ed.waitForSelector('text=A dry run');
    await rec.say('ch8.b3');
    await rec.result(ed.locator('main ul').first(), 'Impact preview: a dry run');
    await rec.quiet(0.6);
    await ed.goto(`${BASE}/rules/versions/${state.vid}`);
    await ed.waitForLoadState('networkidle');
    await rec.click(ed.locator('button:has-text("Submit for review")'), 'Submit for review');
    await rec.click(ed.locator('[role=dialog] button:has-text("Submit for review")'), 'Submit for review');
    await ed.waitForSelector('text=Submitted for review');
    const ap = await pageAs('rules.approver@demo.in', `/rules/versions/${state.vid}/review`);
    await ap.waitForSelector('text=What colleges will read');
    await rec.attach(ap);
    await ed.context().close();
    await rec.say('ch8.b4');
    await rec.result(ap.locator('text=What colleges will read').first(), 'Reviewed by a second person');
    await rec.click(ap.locator('main button:has-text("Approve")').last(), 'Approve');
    await rec.click(ap.locator('[role=dialog] button:has-text("Approve")'), 'Approve');
    await ap.waitForURL(new RegExp(`/rules/versions/${state.vid}$`));
    await rec.click(ap.locator('button:has-text("Publish")'), 'Publish');
    await rec.click(ap.locator('[role=dialog] button:has-text("Publish")'), 'Publish');
    await ap.waitForSelector('text=/^Published/');
    await rec.result(ap.locator('text=/^Published/').first(), 'Published');
    await rec.quiet(0.2);
    const col = await pageAs('college.abc@demo.in', '/college');
    await col.waitForSelector('text=/change.* to the 2027–28 rules since your last visit/');
    await rec.attach(col);
    await ap.context().close();
    await rec.say('ch8.c');
    await rec.result(col.locator('text=/change.* to the 2027–28 rules since your last visit/').first(), 'Colleges see the change');
    await rec.quiet(1);
    await rec.mark('end');
    ok('drafted, refused live, impact, approved by a second person, published, banner');
  },

  async ch9(rec) {
    const p = await pageAs('admin@demo.in', '/admin');
    await rec.attach(p);
    await rec.click(p.getByRole('tab', { name: 'Audit log' }), 'Audit log');
    await rec.say('ch9.b1');
    await rec.click(p.getByRole('button', { name: 'Verify integrity' }), 'Verify integrity');
    await p.waitForSelector('text=OK:');
    await rec.result(p.locator('text=OK:').first(), 'Every row matches its hash');
    await rec.quiet(0.2);
    await rec.say('ch9.b2');
    const cmd = 'npm run demo:tamper';
    const outText = execSync(`cd ${repo} && ${cmd} 2>&1 | tail -1`, { encoding: 'utf8' }).trim();
    rec.log('terminal', { command: cmd, output: outText });
    await rec.quiet(0.3);
    await rec.click(p.getByRole('button', { name: 'Verify integrity' }), 'Verify integrity');
    await p.waitForSelector('text=Broken: row');
    await rec.say('ch9.c1');
    await rec.result(p.locator('[role=alert]:has-text("Broken")').first(), 'Tampering detected');
    await rec.quiet(0.4);
    const ad = await token('admin@demo.in');
    const west = (await call(ad, 'GET', '/applications?region=WEST&limit=1').catch(() => null))?.rows?.[0]?.id ?? state.westId;
    const westId = west ?? execSync(`psql postgresql://aicte_app:app_pw@localhost/aicte -Atc "select a.id from \\"Application\\" a join \\"Region\\" r on r.id=a.\\"regionId\\" where r.code='WEST' order by a.\\"applicationNo\\" limit 1"`, { encoding: 'utf8' }).trim();
    const a = await pageAs('arjun@demo.in', `/cases/${westId}`);
    await a.waitForSelector("text=You don't have access to this page");
    await rec.attach(a);
    await p.context().close();
    await rec.say('ch9.c2');
    await rec.result(a.locator("text=You don't have access to this page").first(), 'Refused, and logged');
    await rec.quiet(1);
    await rec.mark('end');
    ok('integrity OK, tamper detected, access denied');
  },
};

const order = Object.keys(chapters);
const from = process.argv[2] ?? 'ch1';
if (from === 'ch1') {
  console.log(execSync(`cd ${repo} && npm run demo:reset 2>&1 | tail -1`, { encoding: 'utf8' }).trim());
  await sleep(4000);
  for (const k of Object.keys(state)) delete state[k];
}
browser = await chromium.launch();
try {
  for (const ch of order.slice(order.indexOf(from))) {
    console.log(ch);
    const rec = new Recorder(OUT, ch, timings);
    await chapters[ch](rec);
    const { duration } = await rec.finish();
    console.log(`  → ${ch}.mp4 ${duration.toFixed(1)} s`);
    for (const c of browser.contexts()) await c.close();
  }
} finally {
  await browser.close();
}
console.log('RECORDED');
