import React from 'react';
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Audio } from '@remotion/media';
import data from './data/timeline.json';
import { useFonts } from './Fonts';
import { BottomBar } from './overlays';
import { ChapterCard, CloseScene, OpenScene, RecordingScene, SFX, Sfx, Takeaway, Voice } from './scenes';
import type { Chapter, Timeline } from './types';

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

export const Showcase: React.FC<{ cut: Cut }> = ({ cut }) => {
  useFonts();
  const tl = timelineFor(cut);
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
      {/* Quiet music bed, kept low under the voice; a little fuller on the opening and closing cards. */}
      <Audio
        src={staticFile('sfx/music-bed.opus')}
        loop
        volume={(f) => {
          const s = f / fps;
          const edge = s < 1.2 || s > tl.duration - 4 ? 0.1 : 0.055;
          const fadeOut = Math.min(1, Math.max(0, (tl.duration - s) / 2.5));
          return edge * fadeOut;
        }}
      />
      <BottomBar chapters={tl.chapters} current={current} role={role} t={t} total={tl.duration} />
    </AbsoluteFill>
  );
};
