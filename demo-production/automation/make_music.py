"""Background music for the demo video: a soft, warm instrumental bed composed here (no samples or loops from
elsewhere) and played on the MuseScore General soundfont through FluidSynth, then mixed with pedalboard.

    python3 -I make_music.py <seconds> <out.wav>

Arrangement at 70 bpm in C major (Cmaj7 G/B Am7 Fmaj7 Em7 Fmaj7 Dm7 Gsus4-G), no drums: a soft electric piano
playing slow broken chords, a warm pad underneath, a gentle acoustic bass from bar 3, and slow strings that
come and go. Every 24 bars it thins out to pad and piano for 8 bars. The length is built backwards from the
end so the last chord lands 5 s before the video ends and rings out under the closing card. The mix is warm
and out of the voice's way: low-pass at 6.5 kHz, a 2.5 kHz dip where speech is most intelligible, light
compression and a soft hall reverb.
"""
import os
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
BPM = 70
TPB = 480                       # ticks per beat
BAR = 4 * TPB
SEC_PER_TICK = 60 / BPM / TPB

DUR = float(sys.argv[1])
OUT = Path(sys.argv[2])
rnd = random.Random(26)

# Chords: (bass root, chord tones voiced low and close for warmth)
CHORDS = [
    (36, [55, 60, 64, 71]),     # Cmaj7
    (35, [55, 59, 62, 69]),     # G/B (add9)
    (33, [55, 57, 60, 64]),     # Am7
    (29, [57, 60, 64, 65]),     # Fmaj7
    (28, [55, 59, 62, 64]),     # Em7
    (29, [57, 60, 64, 65]),     # Fmaj7
    (38, [53, 57, 60, 62]),     # Dm7
    (31, [55, 60, 62, 67]),     # Gsus4 (resolves to G on beat 3)
]

final_at = DUR - 5.0
bars = int(final_at // (BAR * SEC_PER_TICK))
lead_in = final_at - bars * BAR * SEC_PER_TICK            # seconds of pad swell before bar 0
lead_ticks = int(round(lead_in / SEC_PER_TICK))


def section(i: int) -> str:
    if i < 2:
        return 'intro'
    if i >= bars - 2:
        return 'outro'
    return 'thin' if (i - 2) % 32 >= 24 else 'full'


events: dict[int, list] = {ch: [] for ch in (0, 1, 2, 3)}


def note(ch: int, t: int, n: int, dur: int, vel: int, jitter: int = 12):
    t = max(0, t + rnd.randint(-jitter, jitter))
    vel = max(1, min(127, vel + rnd.randint(-4, 4)))
    events[ch].append((t, 'on', n, vel))
    events[ch].append((t + max(30, dur), 'off', n, 0))


for i in range(bars):
    s = section(i)
    root, tones = CHORDS[i % 8]
    t0 = lead_ticks + i * BAR
    # Warm pad under everything.
    for n in tones:
        note(1, t0, n - 12, BAR + 120, 50 if s in ('intro', 'thin', 'outro') else 44, 0)
    # Electric piano: slow broken chord, one note per beat, long and overlapping (like a held pedal).
    order = [0, 2, 1, 3] if i % 2 == 0 else [0, 3, 1, 2]
    for k in range(4):
        tone = tones[order[k]] + 12
        note(0, t0 + k * TPB, tone, int(TPB * 2.6), (40 if k == 0 else 34) - (4 if s == 'thin' else 0), 18)
    if i % 8 == 7:  # Gsus4 -> G on beat 3
        for n in (59, 62, 67):
            note(0, t0 + 2 * TPB, n + 12, 2 * TPB, 30, 10)
    # Soft bass, long notes, from bar 3; rests in the thin sections.
    if i >= 2 and s in ('full', 'outro'):
        b = root if i % 8 != 7 else 31
        note(2, t0, b, int(TPB * 2.8), 50)
        note(2, t0 + 3 * TPB, b + (7 if i % 2 else 12), int(TPB * 0.9), 40)
    # Slow strings in the full sections, swelling in on every other chord.
    if s in ('full', 'outro') and i % 2 == 0:
        note(3, t0, tones[1] + 12, 2 * BAR + 120, 34, 0)
        note(3, t0, tones[3] + 12, 2 * BAR + 120, 30, 0)

# Final chord: Cmaj9 on pad, piano, strings and bass; rings out.
tf = lead_ticks + bars * BAR
for n in (48, 55, 60, 64, 67, 71):
    note(1, tf, n, int(4.8 / SEC_PER_TICK), 52, 0)
for k, n in enumerate((60, 64, 67, 71, 74)):
    note(0, tf + k * 70, n, int(4.4 / SEC_PER_TICK), 36, 0)
note(3, tf, 76, int(4.6 / SEC_PER_TICK), 32, 0)
note(2, tf, 36, int(4.0 / SEC_PER_TICK), 50, 0)
# Lead-in swell before bar 0.
if lead_ticks > TPB:
    for n in CHORDS[0][1]:
        note(1, 0, n - 12, lead_ticks + 60, 38, 0)

if os.environ.get('MUSIC_SOLO'):  # debugging: render one channel only
    keep = int(os.environ['MUSIC_SOLO'])
    events = {ch: (evs if ch == keep else []) for ch, evs in events.items()}

mid = mido.MidiFile(ticks_per_beat=TPB)
meta = mido.MidiTrack()
meta.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(BPM)))
mid.tracks.append(meta)
PROGRAMS = {0: 4, 1: 89, 2: 32, 3: 49}  # EP1, Warm pad, Acoustic bass, Slow strings
VOLUME = {0: 88, 1: 92, 2: 84, 3: 66}
PAN = {0: 56, 1: 64, 2: 64, 3: 72}
for ch, evs in events.items():
    tr = mido.MidiTrack()
    tr.append(mido.Message('program_change', channel=ch, program=PROGRAMS[ch], time=0))
    for cc, v in ((7, VOLUME[ch]), (10, PAN[ch]), (91, 0), (93, 0)):
        tr.append(mido.Message('control_change', channel=ch, control=cc, value=v, time=0))
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
    HighpassFilter(cutoff_frequency_hz=40),
    PeakFilter(cutoff_frequency_hz=320, gain_db=-1.0, q=0.9),     # keep it warm, not muddy
    PeakFilter(cutoff_frequency_hz=2500, gain_db=-4.0, q=0.8),    # room for the voice
    LowpassFilter(cutoff_frequency_hz=6500),                      # soft, dark top
    Compressor(threshold_db=-22, ratio=1.8, attack_ms=40, release_ms=400),
    Reverb(room_size=0.62, damping=0.6, wet_level=0.24, dry_level=0.8, width=1.0),
])
y = board(audio.T, sr).T
n = int(DUR * sr)
y = y[:n] if len(y) >= n else np.pad(y, ((0, n - len(y)), (0, 0)))
fade_in, fade_out = int(2.0 * sr), int(0.8 * sr)
y[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
y[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
loud = pyln.Meter(sr).integrated_loudness(y)
y = peak_limit(pyln.normalize.loudness(y, loud, -20.0), sr, -1.5)
sf.write(OUT, y, sr, subtype='PCM_16')
print(f'{OUT.name}: {DUR:.1f} s, {bars} bars + lead-in {lead_in:.2f} s, loudness {pyln.Meter(sr).integrated_loudness(y):.1f} LUFS')
