import React, { useMemo } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Audio, Video } from '@remotion/media';
import { cameraAt, cameraKeys } from './camera';
import { CauseArrow, Callout, Chip, ClickPulse, FastBadge, RoleBanner, Spotlight, Subtitle, TerminalCard } from './overlays';
import { C, FONT, H, W } from './theme';
import type { Box, Chapter, Line, RecEvent, Recording } from './types';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const sec = (f: number, fps: number) => f / fps;

// Sound levels. Narration lines are mastered to -18 LUFS (automation/master_voice.py); interface sounds stay
// clearly audible but well under the voice, and typing is thinned so fast-forwarded input does not rattle.
// Everything is mixed with headroom (voice at 0.7); render.sh brings the final mix to -16 LUFS.
export const SFX = { click: 0.32, key: 0.08, pop: 0.21, notice: 0.21, chime: 0.15, whoosh: 0.15, riser: 0.14 };
const KEY_GAP = 0.075; // seconds between audible key taps

export const Sfx: React.FC<{ at: number; name: string; volume: number }> = ({ at, name, volume }) => {
  const { fps } = useVideoConfig();
  return (
    <Sequence from={Math.max(0, Math.round(at * fps))} durationInFrames={Math.round(2 * fps)} layout="none">
      <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
    </Sequence>
  );
};

export const Voice: React.FC<{ at: number; line: Line }> = ({ at, line }) => {
  const { fps } = useVideoConfig();
  return (
    <Sequence from={Math.round(at * fps)} durationInFrames={Math.ceil((line.duration + 0.5) * fps)} layout="none">
      <Audio src={staticFile(line.src)} volume={0.7} />
    </Sequence>
  );
};

// ---------------------------------------------------------------- A. purpose: chapter card

export const ChapterCard: React.FC<{ ch: Chapter }> = ({ ch }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = sec(frame, fps);
  const inn = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const dur = ch.cardDur!;
  const out = interpolate(t, [dur - 0.35, dur], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: C.navyDeep }}>
      <Img src={staticFile(ch.rec!.first)} style={{ position: 'absolute', inset: 0, width: W, height: H, objectFit: 'cover', filter: 'blur(14px) brightness(0.45)', scale: String(1.08 - 0.04 * (t / dur)) }} />
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(7,26,51,.95) 0%, rgba(7,26,51,.75) 55%, rgba(7,26,51,.35) 100%)' }} />
      <div style={{ position: 'absolute', left: 150, top: 300, opacity: out, translate: `${(1 - inn) * -60}px 0`, fontFamily: FONT, color: '#fff' }}>
        <div style={{ fontSize: 34, fontWeight: 700, color: '#93c5fd', letterSpacing: 2 }}>
          CHAPTER {String(ch.number).padStart(2, '0')} / {String(ch.of).padStart(2, '0')}
        </div>
        <div style={{ fontSize: 96, fontWeight: 700, marginTop: 10, lineHeight: 1.05 }}>{ch.title}</div>
        <div style={{ fontSize: 40, fontWeight: 400, marginTop: 22, color: '#dbeafe', maxWidth: 1200 }}>{ch.purpose}</div>
        <div style={{ marginTop: 34, height: 6, width: interpolate(t, [0.2, 1.0], [0, 260], { ...clamp, easing: Easing.out(Easing.cubic) }), background: '#60a5fa', borderRadius: 3 }} />
      </div>
      <Subtitle line={ch.a!} t={t - 0.7} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- B + C. real interaction and verified result

type Boxed = Extract<RecEvent, { box: Box | null }>;

export const RecordingScene: React.FC<{ rec: Recording }> = ({ rec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = sec(frame, fps);
  const keys = useMemo(() => cameraKeys(rec.events, rec.duration), [rec]);
  const cam = cameraAt(keys, t);
  const ev = rec.events;
  let lastKey = -1;
  const seg = rec.segments.find((s) => t >= s.outStart && t < s.outEnd) ?? rec.segments[rec.segments.length - 1];
  const mapBox = (b: Box): Box => {
    const p = cam.map(b.x, b.y);
    return { x: p.x, y: p.y, w: b.w * cam.s, h: b.h * cam.s };
  };
  const results = ev.filter((e): e is Boxed => e.type === 'result' && !!(e as Boxed).box);
  const clicks = ev.filter((e): e is Boxed => e.type === 'click' && !!(e as Boxed).box);
  const RESULT_HOLD = 2.6;
  const activeResult = results.filter((r) => t >= r.t && t < r.t + RESULT_HOLD).pop();
  let attachN = 0;
  return (
    <AbsoluteFill style={{ background: '#fff', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})` }}>
        {rec.segments.map((s, i) => (
          <Sequence key={i} from={Math.round(s.outStart * fps)} durationInFrames={Math.max(1, Math.round((s.outEnd - s.outStart) * fps))} layout="none">
            <Video src={staticFile(rec.video)} trimBefore={Math.round(s.srcStart * fps)} playbackRate={s.rate} muted style={{ width: W, height: H }} />
          </Sequence>
        ))}
      </div>

      {activeResult ? <Spotlight box={mapBox(activeResult.box!)} age={t - activeResult.t} hold={RESULT_HOLD} /> : null}
      {activeResult
        ? (() => {
            // Only a click on the same screen (after the last page switch) is drawn as the cause.
            const lastAttach = ev.filter((x) => x.type === 'attach' && x.t <= activeResult.t).pop()?.t ?? 0;
            const cause = clicks.filter((c) => c.t > lastAttach && c.t < activeResult.t && activeResult.t - c.t < 4).pop();
            if (!cause) return null;
            const from = cam.map(cause.box!.x + cause.box!.w / 2, cause.box!.y + cause.box!.h / 2);
            return <CauseArrow from={from} to={mapBox(activeResult.box!)} age={t - activeResult.t} hold={RESULT_HOLD} />;
          })()
        : null}
      {activeResult ? <Callout box={mapBox(activeResult.box!)} label={activeResult.label ?? ''} age={t - activeResult.t} hold={RESULT_HOLD} tone={/refused|blocked|disabled|tampering/i.test(activeResult.label ?? '') ? 'stop' : 'good'} /> : null}

      {clicks.map((c, i) => {
        const p = cam.map(c.box!.x + c.box!.w / 2, c.box!.y + c.box!.h / 2);
        return <ClickPulse key={i} x={p.x} y={p.y} age={t - c.t} />;
      })}
      {ev.map((e, i) => {
        if (e.type === 'typeStart' && e.box) {
          const end = ev.slice(i).find((x) => x.type === 'typeEnd')?.t ?? e.t + 2;
          if (t < e.t || t > end + 0.4) return null;
          const b = mapBox(e.box);
          return <Chip key={i} x={b.x} y={b.y - 54} icon="⌨" text={`Typing · ${e.label ?? ''}`} age={t - e.t} hold={end - e.t + 0.4} />;
        }
        if (e.type === 'upload' && e.box) {
          if (t < e.t || t > e.t + 2) return null;
          const b = mapBox(e.box);
          return <Chip key={i} x={b.x} y={b.y - 54} icon="📎" text={`${e.file} attached`} age={t - e.t} hold={2} />;
        }
        if (e.type === 'select' && e.box) {
          if (t < e.t || t > e.t + 1.4) return null;
          const b = mapBox(e.box);
          return <Chip key={i} x={b.x} y={b.y - 54} icon="▾" text={`Selected · ${e.label ?? ''}`} age={t - e.t} hold={1.4} />;
        }
        if (e.type === 'terminal') return <TerminalCard key={i} command={e.command} output={e.output} age={t - e.t} hold={4.2} />;
        if (e.type === 'attach') {
          attachN += 1;
          return attachN > 1 ? <RoleBanner key={i} role={e.role} age={t - e.t} /> : null;
        }
        return null;
      })}
      {seg.rate > 1 ? <FastBadge rate={seg.rate} /> : null}
      {ev.map((e, i) => (e.type === 'say' ? <Subtitle key={i} line={e} t={t - e.t} /> : null))}

      {/* sound */}
      {ev.map((e, i) => {
        if (e.type === 'say') return <Voice key={i} at={e.t} line={e} />;
        if (e.type === 'click') return <Sfx key={i} at={e.t} name="click" volume={SFX.click} />;
        if (e.type === 'key') {
          if (e.t - lastKey < KEY_GAP) return null;
          lastKey = e.t;
          return <Sfx key={i} at={e.t} name={`key${(i % 4) + 1}`} volume={SFX.key * (0.85 + 0.3 * ((i * 7) % 5) / 4)} />;
        }
        if (e.type === 'result') return <Sfx key={i} at={e.t} name={/refused|blocked|disabled|tampering/i.test(e.label ?? '') ? 'notice' : 'pop'} volume={SFX.pop} />;
        if (e.type === 'upload') return <Sfx key={i} at={e.t} name="pop" volume={SFX.pop * 0.6} />;
        if (e.type === 'attach' && e.t > 0.5) return <Sfx key={i} at={e.t} name="whoosh" volume={SFX.whoosh} />;
        return null;
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- D. takeaway over the held last frame

export const Takeaway: React.FC<{ ch: Chapter }> = ({ ch }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = sec(frame, fps);
  const dur = ch.takeDur!;
  const inn = spring({ frame: frame - Math.round(0.25 * fps), fps, config: { damping: 15 } });
  const out = interpolate(t, [dur - 0.35, dur], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Img src={staticFile(ch.rec!.last)} style={{ position: 'absolute', inset: 0, width: W, height: H, scale: String(1 - 0.05 * Math.min(1, t / dur)), filter: `brightness(${interpolate(t, [0, 0.5], [1, 0.42], clamp)}) blur(${interpolate(t, [0, 0.5], [0, 3], clamp)}px)` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 360, display: 'flex', justifyContent: 'center', opacity: out }}>
        <div style={{ scale: String(0.85 + 0.15 * inn), opacity: inn, display: 'flex', alignItems: 'center', gap: 28, padding: '34px 50px', borderRadius: 24, background: 'rgba(255,255,255,.97)', boxShadow: '0 30px 80px rgba(0,0,0,.45)', fontFamily: FONT, maxWidth: 1500 }}>
          <span style={{ display: 'inline-flex', width: 76, height: 76, borderRadius: 38, background: C.green, color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 46, flexShrink: 0 }}>✓</span>
          <span style={{ fontSize: 54, fontWeight: 700, color: C.ink, lineHeight: 1.18 }}>{ch.d.text}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- cold open and close

export const OpenScene: React.FC<{ ch: Chapter; montage: { video: string; at: number }[] }> = ({ ch, montage }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = sec(frame, fps);
  const a = ch.a!;
  const titleAt = 0.6 + a.duration + 0.3;
  const clip = (a.duration + 0.6) / montage.length;
  const tin = spring({ frame: frame - Math.round(titleAt * fps), fps, config: { damping: 18 } });
  return (
    <AbsoluteFill style={{ background: C.navyDeep }}>
      {montage.map((m, i) => (
        <Sequence key={i} from={Math.round(i * clip * fps)} durationInFrames={Math.round(clip * fps)}>
          <AbsoluteFill style={{ scale: String(1.18 + 0.06 * ((t - i * clip) / clip)), filter: 'brightness(0.8)' }}>
            <Video src={staticFile(m.video)} trimBefore={Math.round(m.at * fps)} muted style={{ width: W, height: H }} />
          </AbsoluteFill>
        </Sequence>
      ))}
      <AbsoluteFill style={{ background: `rgba(7,26,51,${interpolate(t, [titleAt - 0.3, titleAt + 0.3], [0.25, 0.92], clamp)})` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 330, textAlign: 'center', fontFamily: FONT, color: '#fff', opacity: tin }}>
        <div style={{ display: 'inline-flex', width: 120, height: 120, borderRadius: 16, background: '#fff', color: C.navy, fontSize: 56, fontWeight: 700, alignItems: 'center', justifyContent: 'center' }}>AD</div>
        <div style={{ fontSize: 104, fontWeight: 700, marginTop: 26 }}>AICTE Demo Website</div>
        <div style={{ fontSize: 40, color: '#dbeafe', marginTop: 12 }}>Approval workflow prototype · Smart India Hackathon 2026</div>
        <div style={{ fontSize: 30, color: '#e2e8f0', marginTop: 18, fontWeight: 600 }}>by Team GeoLogics</div>
        <div style={{ fontSize: 26, color: '#93c5fd', marginTop: 22 }}>Prototype on synthetic data · not an official AICTE system</div>
      </div>
      <Subtitle line={a} t={t - 0.6} />
      <Subtitle line={ch.d} t={t - titleAt} />
    </AbsoluteFill>
  );
};

const TEAM = ['sanjayvasudevan-c', 'Arya-Ananth', 'abilashprabakar27-ctrl', 'A-R-Mohamed-Arshad', 'diya-240108'];

export const CloseScene: React.FC<{ ch: Chapter }> = ({ ch }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = sec(frame, fps);
  const ideas = ['Mistakes caught while filing', 'Every assignment and deadline explained', 'Yearly rules: previewed, approved by two, announced', 'Tamper-evident audit, scoped access'];
  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, ${C.navyDeep}, ${C.navy})`, fontFamily: FONT, color: '#fff' }}>
      <div style={{ position: 'absolute', left: 150, top: 140 }}>
        <div style={{ fontSize: 80, fontWeight: 700 }}>AICTE Demo Website</div>
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {ideas.map((x, i) => {
            const p = spring({ frame: frame - Math.round((0.5 + i * 0.35) * fps), fps, config: { damping: 16 } });
            return (
              <div key={i} style={{ opacity: p, translate: `${(1 - p) * 40}px 0`, fontSize: 42, display: 'flex', gap: 18, alignItems: 'center' }}>
                <span style={{ color: '#4ade80' }}>✓</span>
                {x}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 70, opacity: interpolate(t, [2.2, 2.8], [0, 1], clamp) }}>
          <div style={{ fontSize: 30, color: '#93c5fd' }}>Try it live</div>
          <div style={{ fontSize: 64, fontWeight: 700, marginTop: 6 }}>aicte-demo-website.vercel.app</div>
          <div style={{ fontSize: 28, color: '#cbd5e1', marginTop: 12 }}>Pick any demo user · password demo1234 · Admin → Reset demo restores the data</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 150, top: 80, fontSize: 24, color: '#93c5fd' }}>Prototype for Smart India Hackathon 2026 · synthetic data · not an official AICTE system</div>
      <div
        style={{
          position: 'absolute', left: 1300, top: 190, width: 500, padding: '30px 30px', borderRadius: 14,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(147,197,253,0.35)',
          opacity: interpolate(t, [3.0, 3.6], [0, 1], clamp), translate: `0 ${interpolate(t, [3.0, 3.6], [16, 0], clamp)}px`,
        }}
      >
        <div style={{ fontSize: 26, color: '#93c5fd' }}>Built by</div>
        <div style={{ fontSize: 44, fontWeight: 700, marginTop: 4 }}>Team GeoLogics</div>
        <div style={{ fontSize: 22, color: '#cbd5e1', marginTop: 6 }}>SIH 2026 · team ID 197385</div>
        <div style={{ fontSize: 20, color: '#94a3b8', marginTop: 24 }}>On GitHub</div>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TEAM.map((u, i) => (
            <div key={u} style={{ fontSize: 28, whiteSpace: 'nowrap', opacity: interpolate(t, [3.4 + i * 0.15, 3.9 + i * 0.15], [0, 1], clamp) }}>
              {u}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 20, color: '#94a3b8', marginTop: 24 }}>Source code</div>
        <div style={{ fontSize: 16.5, color: '#93c5fd', marginTop: 4, whiteSpace: 'nowrap' }}>github.com/sanjayvasudevan-c/SIH-demo-source-code</div>
      </div>
      <Subtitle line={ch.d} t={t - 0.8} />
    </AbsoluteFill>
  );
};
