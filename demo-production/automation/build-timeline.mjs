// Builds remotion/src/data/timeline.json from the recordings' event logs and the narration timings.
// Edit decisions (all derived from real events, nothing invented):
// - A chapter = card (purpose line A) → recording (lines B/C at their cue times) → held last frame (takeaway D).
// - Inside a recording, time runs at 1× while narration plays and around each verified result; the gaps in
//   between (typing, page loads) run faster, and the video shows a fast-forward badge while they do.
// - Clicks, keystrokes, uploads, results and page switches keep their positions on the output timeline, so
//   zooms, callouts and sound effects land exactly on the real events.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const prod = path.resolve(here, '..');
const script = JSON.parse(fs.readFileSync(path.join(prod, 'narration/script.json'), 'utf8'));
const timings = JSON.parse(fs.readFileSync(path.join(prod, 'narration/audio/timings.json'), 'utf8'));
const FAST = 2.6;
const FPS = 30;
const SCALE = 1.2; // CSS px → video px

const ROLES = {
  ch1: ['Public visitor (not signed in)'],
  ch2: ['College · ABC Engineering College'],
  ch3: ['Scrutiny officer · Priya Raman'],
  ch4: ['Scrutiny officer · Priya Raman', 'College · ABC Engineering College', 'Scrutiny officer · Priya Raman'],
  ch5: ['Administrator (demo tools)', 'Senior officer · Kumar Sharma'],
  ch6: ['Senior officer · Kumar Sharma'],
  ch7: ['EVC desk · Ravi Kumar', 'Committee member', 'Competent authority, South', 'College · ABC Engineering College', 'Scrutiny officer · Priya Raman'],
  ch8: ['Rules editor · Ravi Narayanan', 'Rules approver · Dr. Kavita Rao', 'College · ABC Engineering College'],
  ch9: ['Administrator', 'Officer, South · Arjun Rao'],
};

const line = (id) => {
  const t = timings[id];
  if (!t) throw new Error(`no narration for ${id}`);
  return { id, duration: t.duration, text: t.text, words: t.words, src: `narration/${id}.wav` };
};

function recordingSegment(ch) {
  const dir = path.join(prod, 'recordings', ch);
  const log = JSON.parse(fs.readFileSync(path.join(dir, `${ch}.events.json`), 'utf8'));
  const ev = log.events;
  const end = (ev.find((e) => e.type === 'mark' && e.label === 'end')?.t ?? log.duration) + 0.4;
  // Intervals that play at normal speed.
  const keep = [];
  for (const e of ev) {
    if (e.type === 'say') keep.push([e.t - 0.15, e.t + e.duration + 0.2]);
    if (e.type === 'result') keep.push([e.t - 0.4, e.t + 2.2]);
    if (e.type === 'attach') keep.push([e.t, e.t + 0.8]);
    if (e.type === 'terminal') keep.push([e.t - 0.2, e.t + 3.5]);
  }
  keep.push([0, 0.6], [end - 1.0, end]);
  keep.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [s, e] of keep.map(([s, e]) => [Math.max(0, s), Math.min(end, e)])) {
    if (merged.length && s <= merged.at(-1)[1] + 0.6) merged.at(-1)[1] = Math.max(merged.at(-1)[1], e);
    else merged.push([s, e]);
  }
  // Pieces: [srcStart, srcEnd, rate]
  const pieces = [];
  let cur = 0;
  for (const [s, e] of merged) {
    if (s > cur) pieces.push([cur, s, FAST]);
    pieces.push([s, e, 1]);
    cur = e;
  }
  if (cur < end) pieces.push([cur, end, FAST]);
  let out = 0;
  const segs = pieces.filter(([s, e]) => e - s > 0.01).map(([s, e, rate]) => {
    const seg = { srcStart: +s.toFixed(3), srcEnd: +e.toFixed(3), rate, outStart: +out.toFixed(3) };
    out += (e - s) / rate;
    seg.outEnd = +out.toFixed(3);
    return seg;
  });
  const map = (t) => {
    const g = segs.find((s) => t >= s.srcStart && t <= s.srcEnd) ?? segs.at(-1);
    return +(g.outStart + (Math.min(t, g.srcEnd) - g.srcStart) / g.rate).toFixed(3);
  };
  const box = (b) => (b ? { x: b.x * SCALE, y: b.y * SCALE, w: b.width * SCALE, h: b.height * SCALE } : null);
  let attach = 0;
  const events = [];
  for (const e of ev) {
    if (e.t > end) continue;
    const t = map(e.t);
    if (e.type === 'attach') events.push({ t, type: 'attach', role: ROLES[ch][attach++] ?? '' });
    else if (e.type === 'say') events.push({ t, type: 'say', ...line(e.id) });
    else if (['click', 'hover', 'result', 'typeStart', 'typeEnd', 'select', 'upload'].includes(e.type)) events.push({ t, type: e.type, label: e.label, box: box(e.box), file: e.file, text: e.text });
    else if (e.type === 'key') events.push({ t, type: 'key' });
    else if (e.type === 'terminal') events.push({ t, type: 'terminal', command: e.command, output: e.output });
  }
  // Stills for the chapter card background (first frame) and the held takeaway frame (last kept frame).
  const stills = path.join(prod, 'remotion/public/stills');
  fs.mkdirSync(stills, { recursive: true });
  const grab = (t, name) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(Math.max(0, t)), '-i', path.join(dir, `${ch}.mp4`), '-frames:v', '1', '-q:v', '2', path.join(stills, name)]);
  grab(0.3, `${ch}-first.jpg`);
  grab(end - 0.5, `${ch}-last.jpg`);
  return { video: `recordings/${ch}.mp4`, first: `stills/${ch}-first.jpg`, last: `stills/${ch}-last.jpg`, duration: +out.toFixed(3), segments: segs, events };
}

function chapterList(filter) {
  const chs = script.chapters.filter(filter);
  const numbered = chs.filter((c) => c.id !== 'ch0' && c.id !== 'ch10');
  return chs.map((c) => {
    const lines = Object.fromEntries(c.lines.map((l) => [l.id, line(l.id)]));
    const A = c.lines.find((l) => l.part === 'A');
    const D = c.lines.find((l) => l.part === 'D');
    const base = { id: c.id, title: c.title, purpose: c.purpose, number: numbered.indexOf(c) + 1, of: numbered.length };
    if (c.id === 'ch0') return { ...base, kind: 'open', a: lines[A.id], d: lines[D.id] };
    if (c.id === 'ch10') return { ...base, kind: 'close', d: lines[D.id] };
    return { ...base, kind: 'chapter', a: lines[A.id], d: lines[D.id], rec: recordingSegment(c.id) };
  });
}

function timeline(chapters) {
  // Card: 0.7 s, then line A, then 0.8 s. Takeaway: 0.4 s, line D, then 1.0 s. Open: A over montage, D over title.
  let t = 0;
  const parts = chapters.map((c) => {
    let dur;
    if (c.kind === 'open') dur = 0.6 + c.a.duration + 0.5 + c.d.duration + 1.4;
    else if (c.kind === 'close') dur = 0.8 + c.d.duration + 3.0;
    else {
      c.cardDur = +(0.7 + c.a.duration + 0.8).toFixed(3);
      c.takeDur = +(0.4 + c.d.duration + 1.1).toFixed(3);
      dur = c.cardDur + c.rec.duration + c.takeDur;
    }
    const p = { ...c, start: +t.toFixed(3), duration: +dur.toFixed(3) };
    t += dur;
    return p;
  });
  return { fps: FPS, width: 1920, height: 1080, duration: +t.toFixed(3), frames: Math.ceil(t * FPS), chapters: parts };
}

const main = timeline(chapterList(() => true));
const short = timeline(chapterList((c) => ['ch0', 'ch4', 'ch8', 'ch9', 'ch10'].includes(c.id)));
const outDir = path.join(prod, 'remotion/src/data');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'timeline.json'), JSON.stringify({ main, short }, null, 1));
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
console.log(`main ${fmt(main.duration)}  short ${fmt(short.duration)}`);
for (const c of main.chapters) console.log(`  ${c.id.padEnd(5)} ${fmt(c.duration).padStart(5)}  ${c.title}${c.rec ? `  (recording ${c.rec.duration.toFixed(1)} s)` : ''}`);
