"""Shared audio helpers for the demo soundtrack scripts."""
import numpy as np
from scipy.ndimage import minimum_filter1d, maximum_filter1d, uniform_filter1d


def peak_limit(y: np.ndarray, sr: int, ceiling_db: float = -1.5) -> np.ndarray:
    """Transparent peak limiter: gain only where a peak would pass the ceiling, never any make-up gain.
    y is (samples,) or (samples, channels). The gain is computed from the loudest channel with 2 ms
    look-around, held for 10 ms and smoothed over 5 ms, so it dips just enough and recovers quickly."""
    ceiling = 10 ** (ceiling_db / 20)
    mono = np.abs(y) if y.ndim == 1 else np.abs(y).max(axis=1)
    peak = maximum_filter1d(mono, size=int(0.002 * sr) | 1)
    gain = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    gain = uniform_filter1d(minimum_filter1d(gain, size=int(0.010 * sr) | 1), size=int(0.005 * sr) | 1)
    out = y * (gain if y.ndim == 1 else gain[:, None])
    return np.clip(out, -ceiling, ceiling)
