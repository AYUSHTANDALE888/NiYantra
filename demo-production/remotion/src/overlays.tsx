import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useVideoConfig } from 'remotion';
import { BAR, C, FONT, H, W } from './theme';
import type { Box, Chapter, Line } from './types';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// ---------------------------------------------------------------- subtitles (explain alongside the interface)

export const Subtitle: React.FC<{ line: Line; t: number }> = ({ line, t }) => {
  if (t < -0.05 || t > line.duration + 0.35) return null;
  const words = line.text.split(/\s+/);
  // Map spoken word timings onto script words by position (the transcript can differ in punctuation only).
  const times = line.words;
  const spokenIndex = times.filter((w) => w.s <= t).length;
  const shown = Math.round((spokenIndex / Math.max(1, times.length)) * words.length);
  const op = interpolate(t, [-0.05, 0.15, line.duration + 0.15, line.duration + 0.35], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: BAR + 26, display: 'flex', justifyContent: 'center', opacity: op }}>
      <div style={{ maxWidth: 1380, padding: '12px 26px', borderRadius: 14, background: 'rgba(7, 18, 36, 0.82)', fontFamily: FONT, fontSize: 38, lineHeight: 1.32, fontWeight: 600, textAlign: 'center', color: 'rgba(255,255,255,0.55)', boxShadow: '0 8px 30px rgba(0,0,0,.25)' }}>
        {words.map((w, i) => (
          <span key={i} style={{ color: i < shown ? '#fff' : undefined }}>
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- bottom band (show where you are; chapters)

export const BottomBar: React.FC<{ chapters: Chapter[]; current: Chapter | null; role: string; t: number; total: number }> = ({ chapters, current, role, t, total }) => {
  const numbered = chapters.filter((c) => c.kind === 'chapter');
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: BAR, background: 'rgba(7, 26, 51, 0.94)', display: 'flex', alignItems: 'center', gap: 26, padding: '0 28px', fontFamily: FONT, color: '#fff' }}>
      <div style={{ width: 420, display: 'flex', alignItems: 'baseline', gap: 12, whiteSpace: 'nowrap', overflow: 'hidden' }}>
        {current && current.kind === 'chapter' ? (
          <>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#93c5fd' }}>
              {String(current.number).padStart(2, '0')} / {String(current.of).padStart(2, '0')}
            </span>
            <span style={{ fontSize: 24, fontWeight: 600 }}>{current.title}</span>
          </>
        ) : (
          <span style={{ fontSize: 24, fontWeight: 600 }}>AICTE Demo Website</span>
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
        {numbered.map((c) => {
          const p = interpolate(t, [c.start, c.start + c.duration], [0, 1], clamp);
          return (
            <div key={c.id} title={c.title} style={{ flex: c.duration, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
              <div style={{ width: `${p * 100}%`, height: '100%', background: current?.id === c.id ? '#60a5fa' : '#93c5fd' }} />
            </div>
          );
        })}
      </div>
      <div style={{ width: 470, textAlign: 'right', fontSize: 20, lineHeight: 1.25 }}>
        {role ? <div style={{ fontWeight: 600 }}>Signed in as: {role}</div> : null}
        <div style={{ color: '#cbd5e1', fontSize: 16 }}>Prototype · synthetic data · not an official AICTE system</div>
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, height: 3, width: `${(t / total) * 100}%`, background: '#60a5fa' }} />
    </div>
  );
};

// ---------------------------------------------------------------- spotlight + callout + cause→effect arrow

export const Spotlight: React.FC<{ box: Box; age: number; hold: number }> = ({ box, age, hold }) => {
  const op = interpolate(age, [0, 0.25, hold - 0.3, hold], [0, 1, 1, 0], clamp);
  const pad = 10;
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x - pad,
        top: box.y - pad,
        width: box.w + pad * 2,
        height: box.h + pad * 2,
        borderRadius: 12,
        boxShadow: `0 0 0 4px rgba(37,99,235,${0.95 * op}), 0 0 0 ${W}px rgba(2, 8, 23, ${0.38 * op}), 0 0 40px 8px rgba(96,165,250,${0.55 * op})`,
        pointerEvents: 'none',
      }}
    />
  );
};

export const Callout: React.FC<{ box: Box; label: string; age: number; hold: number; tone: 'good' | 'stop' }> = ({ box, label, age, hold, tone }) => {
  const { fps } = useVideoConfig();
  const pop = spring({ frame: Math.round(age * fps), fps, config: { damping: 14, stiffness: 160 } });
  const out = interpolate(age, [hold - 0.3, hold], [1, 0], clamp);
  const below = box.y + box.h + 120 < H - BAR - 120;
  const x = Math.min(W - 40 - 620, Math.max(40, box.x + box.w / 2 - 220));
  const y = below ? box.y + box.h + 26 : Math.max(24, box.y - 96);
  const color = tone === 'stop' ? C.red : C.green;
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity: out, scale: String(0.6 + 0.4 * pop), transformOrigin: 'left center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', borderRadius: 14, background: '#fff', border: `3px solid ${color}`, boxShadow: '0 14px 40px rgba(2,8,23,.35)', fontFamily: FONT, fontSize: 30, fontWeight: 700, color: C.ink, maxWidth: 620 }}>
        <span style={{ display: 'inline-flex', width: 38, height: 38, borderRadius: 19, background: color, color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{tone === 'stop' ? '!' : '✓'}</span>
        <span>{label}</span>
      </div>
    </div>
  );
};

export const CauseArrow: React.FC<{ from: { x: number; y: number }; to: Box; age: number; hold: number }> = ({ from, to, age, hold }) => {
  const tx = to.x + to.w / 2;
  const ty = to.y + to.h / 2;
  const d = Math.hypot(tx - from.x, ty - from.y);
  if (d < 140) return null;
  const draw = interpolate(age, [0, 0.45], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const op = interpolate(age, [hold - 0.3, hold], [1, 0], clamp);
  // Stop short of the target edge.
  const k = Math.max(0, (d - Math.min(to.w, to.h) / 2 - 18) / d);
  const ex = from.x + (tx - from.x) * k * draw;
  const ey = from.y + (ty - from.y) * k * draw;
  const ang = Math.atan2(ty - from.y, tx - from.x);
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity: op }}>
      <line x1={from.x} y1={from.y} x2={ex} y2={ey} stroke="#f59e0b" strokeWidth={6} strokeLinecap="round" strokeDasharray="2 14" />
      {draw > 0.95 ? (
        <polygon points={`0,0 -24,-12 -24,12`} fill="#f59e0b" transform={`translate(${ex} ${ey}) rotate(${(ang * 180) / Math.PI})`} />
      ) : null}
      <circle cx={from.x} cy={from.y} r={9} fill="#f59e0b" />
    </svg>
  );
};

// ---------------------------------------------------------------- readable interactions

export const ClickPulse: React.FC<{ x: number; y: number; age: number }> = ({ x, y, age }) => {
  if (age < 0 || age > 0.6) return null;
  const r = interpolate(age, [0, 0.6], [10, 54]);
  const op = interpolate(age, [0, 0.6], [0.9, 0]);
  return <div style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, border: `5px solid rgba(245, 158, 11, ${op})`, background: `rgba(245, 158, 11, ${op * 0.18})` }} />;
};

export const Chip: React.FC<{ x: number; y: number; text: string; icon: string; age: number; hold: number }> = ({ x, y, text, icon, age, hold }) => {
  const op = interpolate(age, [0, 0.2, hold - 0.25, hold], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: Math.min(W - 520, Math.max(20, x)), top: Math.max(20, y), opacity: op, display: 'flex', gap: 10, alignItems: 'center', padding: '8px 16px', borderRadius: 999, background: C.navy, color: '#fff', fontFamily: FONT, fontSize: 24, fontWeight: 600, boxShadow: '0 8px 24px rgba(2,8,23,.3)', whiteSpace: 'nowrap' }}>
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
};

export const FastBadge: React.FC<{ rate: number }> = ({ rate }) => (
  <div style={{ position: 'absolute', right: 28, top: 92, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderRadius: 999, background: 'rgba(7,26,51,.85)', color: '#fff', fontFamily: FONT, fontSize: 24, fontWeight: 700 }}>
    <span style={{ letterSpacing: -4 }}>▶▶</span>
    <span>{rate.toFixed(1)}× speed</span>
  </div>
);

export const RoleBanner: React.FC<{ role: string; age: number }> = ({ role, age }) => {
  const { fps } = useVideoConfig();
  if (age < 0 || age > 2.4) return null;
  const inn = spring({ frame: Math.round(age * fps), fps, config: { damping: 16 } });
  const out = interpolate(age, [2.0, 2.4], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 120, display: 'flex', justifyContent: 'center', opacity: out }}>
      <div style={{ translate: `0 ${(1 - inn) * -40}px`, padding: '14px 30px', borderRadius: 16, background: C.navy, color: '#fff', fontFamily: FONT, fontSize: 32, fontWeight: 700, boxShadow: '0 14px 40px rgba(2,8,23,.35)' }}>
        <span style={{ color: '#93c5fd', fontWeight: 600 }}>Now signed in as </span>
        {role}
      </div>
    </div>
  );
};

export const TerminalCard: React.FC<{ command: string; output: string; age: number; hold: number }> = ({ command, output, age, hold }) => {
  if (age < 0 || age > hold) return null;
  const op = interpolate(age, [0, 0.2, hold - 0.3, hold], [0, 1, 1, 0], clamp);
  const typed = command.slice(0, Math.floor(interpolate(age, [0.2, 1.2], [0, command.length], clamp)));
  return (
    <div style={{ position: 'absolute', right: 40, top: 150, width: 820, opacity: op, borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 50px rgba(2,8,23,.45)', fontFamily: 'ui-monospace, monospace' }}>
      <div style={{ background: '#1f2937', color: '#e5e7eb', padding: '10px 16px', fontFamily: FONT, fontSize: 20, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
        <span>Terminal</span>
        <span style={{ color: '#fbbf24' }}>Demo tool · not part of the app</span>
      </div>
      <div style={{ background: '#0b1220', color: '#d1fae5', padding: '18px 20px', fontSize: 24, lineHeight: 1.45 }}>
        <div>$ {typed}</div>
        {age > 1.4 ? <div style={{ color: '#fca5a5', whiteSpace: 'pre-wrap' }}>{output}</div> : null}
      </div>
    </div>
  );
};

export const Fill: React.FC<{ children: React.ReactNode; bg?: string }> = ({ children, bg }) => <AbsoluteFill style={{ background: bg }}>{children}</AbsoluteFill>;
