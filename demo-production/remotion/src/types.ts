export type Box = { x: number; y: number; w: number; h: number };

export type Word = { w: string; s: number; e: number };

export type Line = { id: string; duration: number; text: string; words: Word[]; src: string };

export type RecEvent =
  | { t: number; type: 'attach'; role: string }
  | ({ t: number; type: 'say' } & Line)
  | { t: number; type: 'click' | 'hover' | 'result' | 'typeStart' | 'typeEnd' | 'select' | 'upload'; label?: string; box: Box | null; file?: string; text?: string }
  | { t: number; type: 'key' }
  | { t: number; type: 'terminal'; command: string; output: string };

export type Segment = { srcStart: number; srcEnd: number; rate: number; outStart: number; outEnd: number };

export type Recording = { video: string; first: string; last: string; duration: number; segments: Segment[]; events: RecEvent[] };

export type Chapter = {
  id: string;
  kind: 'open' | 'chapter' | 'close';
  title: string;
  purpose: string;
  number: number;
  of: number;
  start: number;
  duration: number;
  cardDur?: number;
  takeDur?: number;
  a?: Line;
  d: Line;
  rec?: Recording;
};

export type Timeline = { fps: number; width: number; height: number; duration: number; frames: number; chapters: Chapter[] };
