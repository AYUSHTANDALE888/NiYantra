"""Synthesised, license-free sound effects and a quiet ambient music bed (48 kHz WAV).
Run: python3 -I make_sfx.py <out_dir>"""
import sys, numpy as np, soundfile as sf
SR = 48000
out = sys.argv[1]
rng = np.random.default_rng(7)
t = lambda d: np.arange(int(SR * d)) / SR

def env(n, a, d):  # attack (s), exponential decay time constant (s)
    x = np.arange(n) / SR
    return np.minimum(1, x / max(a, 1e-4)) * np.exp(-x / d)

def lp(x, k):  # one-pole low-pass, k in (0,1]
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x):
        acc += k * (v - acc); y[i] = acc
    return y

def hp(x, k): return x - lp(x, k)

def save(name, x, peak=0.8):
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    fade = min(len(x), int(0.004 * SR)); x[-fade:] *= np.linspace(1, 0, fade)
    sf.write(f'{out}/{name}.wav', np.stack([x, x], 1).astype(np.float32), SR)

# Mouse click: a crisp high transient plus a small body thump, then a softer release click.
n = int(0.09 * SR)
click = hp(rng.standard_normal(n), 0.35) * env(n, 0.0003, 0.004) + 0.5 * np.sin(2*np.pi*190*t(0.09)) * env(n, 0.0005, 0.012)
rel = np.zeros(n); off = int(0.055 * SR); rel[off:] = 0.35 * hp(rng.standard_normal(n - off), 0.4) * env(n - off, 0.0003, 0.003)
save('click', click + rel, 0.9)

# Key tap (typing), a few slightly different ones so typing does not sound looped.
for i in range(4):
    n = int(0.05 * SR)
    k = hp(rng.standard_normal(n), 0.25 + 0.05 * i) * env(n, 0.0002, 0.006 + 0.001 * i) + 0.25 * np.sin(2*np.pi*(320 + 40*i)*t(0.05)) * env(n, 0.0004, 0.008)
    save(f'key{i+1}', k, 0.55)

# Whoosh: noise swept through a moving low-pass, rising then falling.
d = 0.55; n = int(d * SR); x = rng.standard_normal(n)
ks = 0.02 + 0.25 * np.sin(np.pi * np.arange(n) / n) ** 2
y = np.empty(n); acc = 0.0
for i in range(n):
    acc += ks[i] * (x[i] - acc); y[i] = acc
save('whoosh', y * np.sin(np.pi * np.arange(n) / n) ** 1.5, 0.6)

# Soft pop for callouts appearing.
n = int(0.12 * SR); f = np.linspace(900, 420, n)
save('pop', np.sin(2*np.pi*np.cumsum(f)/SR) * env(n, 0.002, 0.03), 0.5)

# Success chime: two bell partial pairs (E6, B6) a beat apart.
def bell(f0, d):
    n = int(d * SR); x = t(d)
    return sum(a * np.sin(2*np.pi*f0*m*x) * np.exp(-x / (d * 0.35 / m**0.5)) for m, a in [(1, 1), (2.01, 0.35), (3.02, 0.12)])
c = np.zeros(int(1.4 * SR)); b1 = bell(1318.5, 1.0); b2 = bell(1975.5, 1.1)
c[:len(b1)] += b1; s = int(0.12 * SR); c[s:s+len(b2)] += 0.8 * b2[:len(c)-s]
save('chime', c, 0.5)

# Gentle negative tone for refusals/errors (two low notes, descending, not harsh).
n = int(0.5 * SR); x = t(0.5)
neg = np.sin(2*np.pi*392*x) * env(n, 0.005, 0.12); neg[int(0.16*SR):] += np.sin(2*np.pi*311*x[:n-int(0.16*SR)]) * env(n-int(0.16*SR), 0.005, 0.15)
save('notice', neg, 0.45)

# Chapter riser: short shimmering swell into chapter cards.
d = 1.2; n = int(d * SR); x = t(d)
riser = sum(np.sin(2*np.pi*f*x*(1 + 0.15*x/d)) for f in (523.25, 659.25, 783.99)) * (x/d)**2 * np.exp(-((x-d)/0.15)**2 * 0.0 )
riser *= np.minimum(1, (d - x) / 0.08)
save('riser', riser + 0.3 * lp(rng.standard_normal(n), 0.1) * (x/d)**3, 0.4)

# Ambient bed, 5 min 30 s: slow pad chords (Cmaj9 → Am7 → Fmaj7 → Gsus) on soft detuned sines,
# 8 bars of 8 s each, looped, gently low-passed; meant to sit about 22 dB under the voice.
D = 330; x = t(D); bed = np.zeros_like(x)
chords = [[130.81, 196.0, 246.94, 293.66], [110.0, 164.81, 196.0, 261.63], [87.31, 174.61, 220.0, 261.63], [98.0, 146.83, 196.0, 293.66]]
bar = 8.0
for i in range(int(D / bar) + 1):
    ch = chords[i % 4]; s0 = int(i * bar * SR); n = int((bar + 2.5) * SR); seg = t(bar + 2.5)
    shape = np.minimum(1, seg / 2.0) * np.minimum(1, np.maximum(0, (bar + 2.5 - seg)) / 2.5)
    voice = sum(0.25 * (np.sin(2*np.pi*f*seg) + 0.6*np.sin(2*np.pi*f*1.003*seg + 1) + 0.15*np.sin(2*np.pi*2*f*seg)) for f in ch)
    e = min(len(bed), s0 + n) - s0
    if e > 0: bed[s0:s0+e] += (voice * shape)[:e]
bed *= 0.85 + 0.15 * np.sin(2*np.pi*x/23)  # slow swell
bed = lp(bed, 0.08)
bed[: int(3*SR)] *= np.linspace(0, 1, int(3*SR)); bed[-int(4*SR):] *= np.linspace(1, 0, int(4*SR))
save('music-bed', bed, 0.5)
print('ok')
