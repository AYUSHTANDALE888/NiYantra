"""Background music for the demo video: a calm, warm instrumental bed composed here (no samples or loops
from elsewhere) and played on the MuseScore General soundfont through FluidSynth, then mixed with pedalboard.

    python3 -I make_music.py <seconds> <out.wav>

Arrangement at 92 bpm in C major (Cmaj7 G/B Am7 Fmaj7 Em7 Fmaj7 Dm7 Gsus4-G): electric piano arpeggios, warm pad,
fingered bass, soft brushed-style drums; strings and a vibraphone line in the "lift" sections; a sparse
breakdown every 32 bars. The length is built backwards from the end so the last chord lands 4.5 s before the
video ends and rings out under the closing card. The mix leaves room for the narration: a 2.5 kHz dip where
speech is most intelligible, a gentle low-cut, light glue compression and a small room reverb.
"""
import random
import subprocess
import sys
import tempfile
from pathlib import Path

import mido
import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from pedalboard import Compressor, HighpassFilter, LowpassFilter, Pedalboard, PeakFilter, Reverb

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with python3 -I, which drops the script dir
from audio_utils import peak_limit  # noqa: E402

SF = '/usr/share/sounds/sf3/MuseScore_General_Full.sf3'
SR = 48000
BPM = 92
TPB = 480                       # ticks per beat
BAR = 4 * TPB
SEC_PER_TICK = 60 / BPM / TPB

DUR = float(sys.argv[1])
OUT = Path(sys.argv[2])
rnd = random.Random(26)

# Chords: (bass root, chord tones as MIDI numbers around middle C)
CHORDS = [
    (36, [60, 64, 67, 71]),     # Cmaj7
    (35, [59, 62, 67, 69]),     # G/B (add9)
    (33, [57, 60, 64, 67]),     # Am7
    (29, [57, 60, 64, 65]),     # Fmaj7
    (28, [59, 62, 64, 67]),     # Em7
    (29, [57, 60, 64, 65]),     # Fmaj7
    (38, [57, 60, 62, 65]),     # Dm7
    (31, [60, 62, 67, 67]),     # Gsus4 (resolves to G on beat 3)
]
VIBES = [  # (bar in 8-bar loop, beat, note, beats)
    (0, 0, 76, 1.5), (0, 2, 79, 2), (1, 0, 74, 3), (2, 0, 72, 1.5), (2, 2, 76, 2), (3, 0, 69, 3.5),
    (4, 0, 71, 1.5), (4, 2, 74, 2), (5, 0, 72, 1.5), (5, 2, 69, 2), (6, 0, 74, 2), (6, 2, 72, 2), (7, 0, 71, 2), (7, 2, 67, 2),
]

final_at = DUR - 4.5
bars = int(final_at // (BAR * SEC_PER_TICK))
lead_in = final_at - bars * BAR * SEC_PER_TICK            # seconds of pad swell before bar 0
lead_ticks = int(round(lead_in / SEC_PER_TICK))


def section(i: int) -> str:
    if i < 4:
        return 'intro'
    if i >= bars - 4:
        return 'outro'
    k = (i - 4) % 32
    return 'A' if k < 8 else 'B' if k < 16 else 'A2' if k < 24 else 'break'


events: dict[int, list] = {ch: [] for ch in (0, 1, 2, 3, 4, 9)}


def note(ch: int, t: int, n: int, dur: int, vel: int, jitter: int = 10):
    t = max(0, t + rnd.randint(-jitter, jitter))
    vel = max(1, min(127, vel + rnd.randint(-5, 5)))
    events[ch].append((t, 'on', n, vel))
    events[ch].append((t + max(30, dur), 'off', n, 0))


for i in range(bars):
    s = section(i)
    root, tones = CHORDS[i % 8]
    t0 = lead_ticks + i * BAR
    # Pad: always, softer in the busy sections.
    for n in tones:
        note(1, t0, n - 12, BAR + 60, {'intro': 52, 'break': 58, 'outro': 55}.get(s, 44), 0)
    # Electric piano arpeggio in eighths (quarters in the intro).
    order = [0, 2, 1, 3, 2, 1, 3, 2]
    step = TPB if s == 'intro' else TPB // 2
    for k in range(BAR // step):
        tone = tones[order[k % 8]] + (12 if order[k % 8] >= 2 and s in ('B', 'A2') else 0)
        accent = 8 if (k * step) % TPB == 0 else 0
        note(0, t0 + k * step, tone, int(step * 1.6), {'intro': 46, 'break': 50}.get(s, 52) + accent, 12)
    # Bass from the second intro bar.
    if i >= 2 and s != 'break':
        b = root if i % 8 != 7 else 31
        note(2, t0, b, int(TPB * 1.4), 66)
        note(2, t0 + int(TPB * 1.5), b, TPB // 2 - 20, 54)
        note(2, t0 + 2 * TPB, b + (7 if i % 2 else 12), int(TPB * 1.8), 60)
    # Drums: soft kick, side stick, closed hat; a quiet crash at each section start.
    if s in ('A', 'B', 'A2') or (s == 'outro' and i < bars - 2):
        for beat in range(4):
            tb = t0 + beat * TPB
            if beat in (0, 2):
                note(9, tb, 36, 120, 58 if beat == 0 else 50, 6)
            else:
                note(9, tb, 37, 100, 40, 6)
            note(9, tb, 42, 80, 34, 6)
            note(9, tb + TPB // 2, 42, 80, 24, 8)
        if (i - 4) % 8 == 0 and s != 'outro':
            note(9, t0, 49, 400, 34, 0)
    # Strings and vibraphone in the lift sections and the outro.
    if s in ('B', 'outro', 'break'):
        note(3, t0, tones[1] + 12, BAR + 120, 44 if s != 'break' else 38, 0)
        note(3, t0, tones[3] + 12, BAR + 120, 40 if s != 'break' else 34, 0)
    if s == 'B':
        for bar_k, beat, n, beats in VIBES:
            if bar_k == i % 8:
                note(4, t0 + int(beat * TPB), n, int(beats * TPB), 50, 14)
    if i % 8 == 7:  # Gsus4 -> G on beat 3
        for n in (59, 62, 67):
            note(0, t0 + 2 * TPB, n, 2 * TPB, 44, 8)

# Final chord: Cmaj9 across pad, piano, strings, bass; rings out.
tf = lead_ticks + bars * BAR
for n in (48, 55, 60, 64, 67, 71, 74):
    note(1, tf, n, int(4.4 / SEC_PER_TICK), 58, 0)
for n in (60, 64, 67, 71, 74):
    note(0, tf + rnd.randint(0, 40), n, int(4.0 / SEC_PER_TICK), 50, 0)
note(3, tf, 76, int(4.2 / SEC_PER_TICK), 42, 0)
note(2, tf, 36, int(3.5 / SEC_PER_TICK), 62, 0)
# Lead-in swell before bar 0.
if lead_ticks > TPB:
    for n in CHORDS[0][1]:
        note(1, 0, n - 12, lead_ticks + 60, 40, 0)

import os
if os.environ.get('MUSIC_SOLO'):  # debugging: render one channel only
    keep = int(os.environ['MUSIC_SOLO'])
    events = {ch: (evs if ch == keep else []) for ch, evs in events.items()}
mid = mido.MidiFile(ticks_per_beat=TPB)
meta = mido.MidiTrack()
meta.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(BPM)))
mid.tracks.append(meta)
PROGRAMS = {0: 4, 1: 89, 2: 33, 3: 49, 4: 11}  # EP1, Warm pad, Fingered bass, Slow strings, Vibraphone
VOLUME = {0: 92, 1: 84, 2: 96, 3: 70, 4: 74, 9: 72}
PAN = {0: 54, 1: 64, 2: 64, 3: 74, 4: 46, 9: 64}
for ch, evs in events.items():
    tr = mido.MidiTrack()
    if ch != 9:
        tr.append(mido.Message('program_change', channel=ch, program=PROGRAMS[ch], time=0))
    tr.append(mido.Message('control_change', channel=ch, control=7, value=VOLUME[ch], time=0))
    tr.append(mido.Message('control_change', channel=ch, control=10, value=PAN[ch], time=0))
    tr.append(mido.Message('control_change', channel=ch, control=91, value=0, time=0))
    tr.append(mido.Message('control_change', channel=ch, control=93, value=0, time=0))
    last = 0
    for t, kind, n, vel in sorted(evs, key=lambda e: (e[0], e[1] == 'on')):
        msg = 'note_on' if kind == 'on' else 'note_off'
        tr.append(mido.Message(msg, channel=ch, note=n, velocity=vel, time=t - last))
        last = t
    mid.tracks.append(tr)

with tempfile.TemporaryDirectory() as td:
    mpath, wpath = Path(td) / 'bed.mid', Path(td) / 'bed.wav'
    mid.save(mpath)
    subprocess.run(['fluidsynth', '-ni', '-q', '-R', '0', '-C', '0', '-g', '0.5', '-r', str(SR), '-F', str(wpath), SF, str(mpath)], check=True)
    audio, sr = sf.read(wpath, dtype='float32', always_2d=True)

board = Pedalboard([
    HighpassFilter(cutoff_frequency_hz=45),
    PeakFilter(cutoff_frequency_hz=300, gain_db=-1.5, q=0.9),     # less mud
    PeakFilter(cutoff_frequency_hz=2500, gain_db=-3.5, q=0.8),    # room for the voice
    LowpassFilter(cutoff_frequency_hz=12000),
    Compressor(threshold_db=-20, ratio=2.0, attack_ms=25, release_ms=250),
    Reverb(room_size=0.42, damping=0.55, wet_level=0.16, dry_level=0.86, width=0.9),
])
y = board(audio.T, sr).T
n = int(DUR * sr)
y = y[:n] if len(y) >= n else np.pad(y, ((0, n - len(y)), (0, 0)))
fade_in, fade_out = int(1.5 * sr), int(0.6 * sr)
y[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
y[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
loud = pyln.Meter(sr).integrated_loudness(y)
y = peak_limit(pyln.normalize.loudness(y, loud, -20.0), sr, -1.5)
sf.write(OUT, y, sr, subtype='PCM_16')
print(f'{OUT.name}: {DUR:.1f} s, {bars} bars + lead-in {lead_in:.2f} s, loudness {pyln.Meter(sr).integrated_loudness(y):.1f} LUFS')
