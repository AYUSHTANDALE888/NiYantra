"""Narration mastering: every line gets the same treatment and the same loudness, so the voice sounds like one
recording session and sits steadily above the music.

    python3 -I master_voice.py <in_dir> <out_dir>

24 kHz Chatterbox WAV -> 48 kHz: low cut at 80 Hz, a little less boom (180 Hz), presence (3 kHz), softer
sibilance (6.5 kHz), gentle compression, then each line normalised to -18 LUFS with a -1.5 dB ceiling.
Line lengths are unchanged (exactly 2x the samples), so the edit timings stay valid.
"""
import sys
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from pedalboard import Compressor, HighpassFilter, Pedalboard, PeakFilter
from scipy.signal import resample_poly

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with python3 -I, which drops the script dir
from audio_utils import peak_limit  # noqa: E402

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)
SR = 48000
board = Pedalboard([
    HighpassFilter(cutoff_frequency_hz=80),
    PeakFilter(cutoff_frequency_hz=180, gain_db=-2.0, q=1.0),
    PeakFilter(cutoff_frequency_hz=3000, gain_db=2.0, q=0.8),
    PeakFilter(cutoff_frequency_hz=6500, gain_db=-1.5, q=1.5),
    Compressor(threshold_db=-22, ratio=2.5, attack_ms=5, release_ms=80),
])
meter = pyln.Meter(SR)
for p in sorted(src.glob('*.wav')):
    y, sr = sf.read(p, dtype='float32', always_2d=True)
    y = y.mean(1)
    if sr != SR:
        y = resample_poly(y, SR, sr).astype(np.float32)
    y = board(y[None, :], SR)[0]
    if len(y) > SR * 0.4:
        y = pyln.normalize.loudness(y, meter.integrated_loudness(y), -18.0)
    y = peak_limit(y, SR, -1.5).astype(np.float32)
    f = int(0.005 * SR)
    y[:f] *= np.linspace(0, 1, f)
    y[-f:] *= np.linspace(1, 0, f)
    sf.write(dst / p.name, y, SR, subtype='PCM_16')
print(f'mastered {len(list(src.glob("*.wav")))} lines -> {dst}')
