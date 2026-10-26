import { Easing, interpolate } from 'remotion';
import type { Box, RecEvent } from './types';
import { H, W } from './theme';

// Guide the viewer's eyes: the camera eases toward each element about to be used (click, typing, upload) and
// toward each verified result, holds, and eases back out when nothing happens for a while.
type Key = { t: number; s: number; cx: number; cy: number };

const LEAD = 0.5; // start moving this long before the event
const MOVE = 0.55;
const ZOOM = { click: 1.35, select: 1.35, typeStart: 1.5, upload: 1.4, result: 1.6 } as const;
const HOLD = { click: 1.4, select: 1.4, typeStart: 1.6, upload: 1.6, result: 2.6 } as const;

const fit = (b: Box, z: number) => Math.max(1, Math.min(z, (0.72 * W) / Math.max(b.w, 1), (0.6 * H) / Math.max(b.h, 1)));

export function cameraKeys(events: RecEvent[], duration: number): Key[] {
  const focus = events.filter(
    (e): e is Extract<RecEvent, { box: Box | null }> => (e.type === 'click' || e.type === 'select' || e.type === 'typeStart' || e.type === 'upload' || e.type === 'result') && !!(e as { box?: Box | null }).box,
  );
  const keys: Key[] = [{ t: 0, s: 1, cx: W / 2, cy: H / 2 }];
  const last = () => keys[keys.length - 1];
  focus.forEach((e, i) => {
    const type = e.type as keyof typeof ZOOM;
    const b = e.box!;
    const s = fit(b, ZOOM[type]);
    const target = { s, cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
    const start = Math.max(last().t, e.t - LEAD);
    keys.push({ t: start, s: last().s, cx: last().cx, cy: last().cy });
    keys.push({ t: Math.max(start + 0.05, Math.min(e.t, start + MOVE)), ...target });
    const next = focus[i + 1];
    const releaseAt = e.t + HOLD[type];
    if (!next || next.t - LEAD > releaseAt + 0.9) {
      keys.push({ t: releaseAt, ...target });
      keys.push({ t: releaseAt + 0.7, s: 1, cx: W / 2, cy: H / 2 });
    }
  });
  keys.push({ t: Math.max(last().t, duration), s: last().s, cx: last().cx, cy: last().cy });
  return keys;
}

export function cameraAt(keys: Key[], t: number) {
  let i = keys.findIndex((k, j) => j < keys.length - 1 && t >= k.t && t <= keys[j + 1].t);
  if (i < 0) i = t < keys[0].t ? 0 : keys.length - 2;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const k = b.t > a.t ? interpolate(t, [a.t, b.t], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.45, 0, 0.2, 1) }) : 1;
  const s = a.s + (b.s - a.s) * k;
  let cx = a.cx + (b.cx - a.cx) * k;
  let cy = a.cy + (b.cy - a.cy) * k;
  // Keep the view inside the frame.
  const hw = W / 2 / s;
  const hh = H / 2 / s;
  cx = Math.min(W - hw, Math.max(hw, cx));
  cy = Math.min(H - hh, Math.max(hh, cy));
  const tx = W / 2 - cx * s;
  const ty = H / 2 - cy * s;
  return { s, tx, ty, map: (x: number, y: number) => ({ x: x * s + tx, y: y * s + ty }) };
}
