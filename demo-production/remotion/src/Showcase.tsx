import React, { useMemo } from 'react';
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Audio } from '@remotion/media';
import data from './data/timeline.json';
import { useFonts } from './Fonts';
import { BottomBar } from './overlays';
import { ChapterCard, CloseScene, OpenScene, RecordingScene, SFX, Sfx, Takeaway, Voice } from './scenes';
import type { Chapter, Line, Timeline } from './types';

export type Cut = 'main' | 'short';
export const timelineFor = (cut: Cut) => (data as unknown as Record<Cut, Timeline>)[cut];

// Cold-open montage: real moments from the recordings (first verified result of a few chapters).
const montageFor = (chs: Chapter[]) =>
  chs
    .filter((c) => c.rec)
    .slice(0, 6)
    .map((c) => {
      const r = c.rec!.events.find((e) => e.type === 'result');
      const seg = c.rec!.segments.find((s) => r && r.t >= s.outStart && r.t <= s.outEnd) ?? c.rec!.segments[0];
      const src = r ? seg.srcStart + (r.t - seg.outStart) * seg.rate : 0;
      return { video: c.rec!.video, at: Math.max(0, src - 0.4) };
    });

// Every stretch of narration in absolute seconds, mirroring where <Voice> is placed below; gaps shorter than
// 1.4 s are bridged so the music does not pump between sentences.
const voiceSpans = (tl: Timeline): [number, number][] => {
  const s: [number, number][] = [];
  for (const c of tl.chapters) {
    const add = (at: number, l?: Line) => l && s.push([c.start + at, c.start + at + l.duration]);
    if (c.kind === 'open') {
      add(0.6, c.a);
      add(0.6 + c.a!.duration + 0.3, c.d);
    } else if (c.kind === 'close') add(0.8, c.d);
    else {
      add(0.7, c.a);
      for (const e of c.rec!.events) if (e.type === 'say') add(c.cardDur! + e.t, e);
      add(c.cardDur! + c.rec!.duration + 0.4, c.d);
    }
  }
  s.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const sp of s) {
    const last = merged[merged.length - 1];
    if (last && sp[0] - last[1] < 1.4) last[1] = Math.max(last[1], sp[1]);
    else merged.push([...sp]);
  }
  return merged;
};

// Music level: ducked about 5 dB below its level between sentences, so it sits about 22 dB under the voice (smooth 0.3 s dip, 0.9 s recovery), a little fuller on the
// opening and closing cards.
const MUSIC = { underVoice: 0.1, between: 0.17, cards: 0.26 };
const musicGain = (t: number, spans: [number, number][], tl: Timeline) => {
  let v = 0;
  for (const [a, b] of spans) {
    if (t < a - 0.3 || t > b + 0.9) continue;
    v = Math.max(v, t < a ? (t - (a - 0.3)) / 0.3 : t <= b ? 1 : 1 - (t - b) / 0.9);
  }
  const close = tl.chapters[tl.chapters.length - 1];
  const free = t < tl.chapters[0].duration || t >= close.start ? MUSIC.cards : MUSIC.between;
  const smooth = v * v * (3 - 2 * v);
  return free + (MUSIC.underVoice - free) * smooth;
};

export const Showcase: React.FC<{ cut: Cut }> = ({ cut }) => {
  useFonts();
  const tl = timelineFor(cut);
  const spans = useMemo(() => voiceSpans(tl), [tl]);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const current = tl.chapters.find((c) => t >= c.start && t < c.start + c.duration) ?? null;
  let role = '';
  if (current?.rec) {
    const local = t - current.start - current.cardDur!;
    if (local >= 0 && local <= current.rec.duration) {
      for (const e of current.rec.events) if (e.type === 'attach' && e.t <= local) role = e.role;
    }
  }
  const F = (s: number) => Math.round(s * fps);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {tl.chapters.map((c) => (
        <Sequence key={c.id} from={F(c.start)} durationInFrames={F(c.duration)} name={`${c.id} · ${c.title}`}>
          {c.kind === 'open' ? (
            <>
              <OpenScene ch={c} montage={montageFor(tl.chapters)} />
              <Voice at={0.6} line={c.a!} />
              <Voice at={0.6 + c.a!.duration + 0.3} line={c.d} />
              <Sfx at={0.6 + c.a!.duration + 0.1} name="riser" volume={SFX.riser} />
            </>
          ) : c.kind === 'close' ? (
            <>
              <CloseScene ch={c} />
              <Voice at={0.8} line={c.d} />
              <Sfx at={0.2} name="whoosh" volume={SFX.whoosh} />
            </>
          ) : (
            <>
              <Sequence durationInFrames={F(c.cardDur!)} name="A · purpose">
                <ChapterCard ch={c} />
                <Voice at={0.7} line={c.a!} />
                <Sfx at={0} name="whoosh" volume={SFX.whoosh} />
              </Sequence>
              <Sequence from={F(c.cardDur!)} durationInFrames={F(c.rec!.duration)} name="B+C · interaction and result">
                <RecordingScene rec={c.rec!} />
              </Sequence>
              <Sequence from={F(c.cardDur! + c.rec!.duration)} durationInFrames={F(c.takeDur!)} name="D · takeaway">
                <Takeaway ch={c} />
                <Voice at={0.4} line={c.d} />
                <Sfx at={0.25} name="chime" volume={SFX.chime} />
              </Sequence>
            </>
          )}
        </Sequence>
      ))}
      {/* Music composed to this cut's exact length (automation/make_music.py), ducked under the narration. */}
      <Audio src={staticFile(`sfx/music-${cut}.opus`)} volume={(f) => musicGain(f / fps, spans, tl)} />
      <BottomBar chapters={tl.chapters} current={current} role={role} t={t} total={tl.duration} />
    </AbsoluteFill>
  );
};
