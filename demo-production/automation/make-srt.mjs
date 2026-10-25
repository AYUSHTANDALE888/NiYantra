// Writes out/<cut>.srt (subtitles) and out/<cut>.chapters.txt (YouTube chapter list, ffmpeg metadata) from the
// same timeline the video is rendered from, so the text and times match the burned-in subtitles exactly.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const prod = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(prod, 'remotion/src/data/timeline.json'), 'utf8'));
const outDir = path.join(prod, 'out');
fs.mkdirSync(outDir, { recursive: true });
const ts = (s) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(r).padStart(3, '0')}`;
};
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

for (const [cut, tl] of Object.entries(data)) {
  const cues = [];
  for (const c of tl.chapters) {
    if (c.kind === 'open') {
      cues.push([c.start + 0.6, c.a]);
      cues.push([c.start + 0.6 + c.a.duration + 0.3, c.d]);
    } else if (c.kind === 'close') cues.push([c.start + 0.8, c.d]);
    else {
      cues.push([c.start + 0.7, c.a]);
      for (const e of c.rec.events) if (e.type === 'say') cues.push([c.start + c.cardDur + e.t, e]);
      cues.push([c.start + c.cardDur + c.rec.duration + 0.4, c.d]);
    }
  }
  const srt = cues.map(([s, l], i) => `${i + 1}\n${ts(s)} --> ${ts(s + l.duration + 0.2)}\n${l.text}\n`).join('\n');
  fs.writeFileSync(path.join(outDir, `${cut}.srt`), srt);
  const chapters = tl.chapters.map((c) => `${mmss(c.start)} ${c.kind === 'chapter' ? `${c.number}. ${c.title}` : c.kind === 'open' ? 'Introduction' : 'Try it live'}`);
  fs.writeFileSync(path.join(outDir, `${cut}.chapters.txt`), chapters.join('\n') + '\n');
  const meta = [';FFMETADATA1', ...tl.chapters.flatMap((c) => ['[CHAPTER]', 'TIMEBASE=1/1000', `START=${Math.round(c.start * 1000)}`, `END=${Math.round((c.start + c.duration) * 1000)}`, `title=${c.kind === 'chapter' ? `${c.number}. ${c.title}` : c.kind === 'open' ? 'Introduction' : 'Try it live'}`])];
  fs.writeFileSync(path.join(outDir, `${cut}.ffmeta`), meta.join('\n') + '\n');
  console.log(`${cut}: ${cues.length} subtitle cues, ${tl.chapters.length} chapters`);
}
