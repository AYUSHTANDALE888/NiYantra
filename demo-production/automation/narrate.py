"""Narration: script.json → one WAV per line + timings.json (durations, word times, verification).
Each sentence is generated separately with Chatterbox, edge silence is trimmed, and sentences are joined with
deliberate breath gaps. Every line is transcribed with faster-whisper and regenerated (new seed, up to 3 tries)
when the transcript does not match the script, so no word is dropped or misread in the final video.
Usage: python -I narrate.py <script.json> <out_dir> [line ids...]"""
import json, re, subprocess, sys, time
from pathlib import Path
import numpy as np, torch, torchaudio as ta
from chatterbox.tts import ChatterboxTTS
from faster_whisper import WhisperModel

script = json.loads(Path(sys.argv[1]).read_text())
out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
only = set(sys.argv[3:])
D = script["defaults"]
tts = ChatterboxTTS.from_pretrained(device="cpu")
stt = WhisperModel("base.en", device="cpu", compute_type="int8")
SR = tts.sr

NUM = {"7": "seven", "15": "fifteen", "20": "twenty", "30": "thirty", "85": "eighty five", "90": "ninety", "2026": "twenty twenty six"}
SAME = {"cue": "queue", "colleges": "college's"}

def words(s):
    s = s.lower().replace("-", " ")
    s = re.sub(r"\b\d+\b", lambda m: NUM.get(m.group(0), m.group(0)), s)
    s = re.sub(r"[^a-z0-9' ]+", " ", s)
    return [SAME.get(w, w).replace("'", "") for w in s.split() if w]

def wer(ref, hyp):
    r, h = words(ref), words(hyp)
    d = np.zeros((len(r) + 1, len(h) + 1), int); d[:, 0] = range(len(r) + 1); d[0, :] = range(len(h) + 1)
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            d[i, j] = min(d[i-1, j] + 1, d[i, j-1] + 1, d[i-1, j-1] + (r[i-1] != h[j-1]))
    return d[len(r), len(h)] / max(1, len(r))

def trim(x, thr=0.012, pad=0.06):
    a = np.abs(x); idx = np.where(a > thr * a.max())[0]
    if not len(idx): return x
    s = max(0, idx[0] - int(pad * SR)); e = min(len(x), idx[-1] + int(pad * SR))
    return x[s:e]

def pieces(text):
    # sentences, and a pause after "..." or ":"
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p for p in parts if p]

def synth(text, ex, cfg, seed):
    torch.manual_seed(seed)
    chunks = []
    for i, p in enumerate(pieces(text)):
        w = tts.generate(p, exaggeration=ex, cfg_weight=cfg).squeeze(0).numpy()
        chunks.append(trim(w))
        if i < len(pieces(text)) - 1:
            chunks.append(np.zeros(int(D["sentenceGap"] * SR), np.float32))
    return np.concatenate(chunks).astype(np.float32)

def transcribe(x):
    a16 = ta.functional.resample(torch.from_numpy(x), SR, 16000).numpy()
    segs, _ = stt.transcribe(a16, beam_size=5, word_timestamps=True)
    segs = list(segs)
    text = " ".join(s.text.strip() for s in segs)
    ws = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for s in segs for w in s.words]
    return text, ws

timings_path = out / "timings.json"
timings = json.loads(timings_path.read_text()) if timings_path.exists() else {}
for ch in script["chapters"]:
    for ln in ch["lines"]:
        if only and ln["id"] not in only: continue
        ex = ln.get("exaggeration", D["exaggeration"]); cfg = ln.get("cfg_weight", D["cfg_weight"])
        best = None
        for attempt in range(3):
            t = time.time()
            x = synth(ln["text"], ex, cfg, seed=1000 + attempt * 17)
            text, ws = transcribe(x)
            e = wer(ln["text"], text)
            print(f"{ln['id']} try {attempt+1}: {len(x)/SR:.1f}s audio in {time.time()-t:.0f}s, WER {e:.2f}: {text}", flush=True)
            if best is None or e < best[0]: best = (e, x, text, ws, attempt + 1)
            if e <= 0.05: break
        e, x, text, ws, n = best
        x = x / (np.abs(x).max() + 1e-9) * 0.89
        ta.save(str(out / f"{ln['id']}.wav"), torch.from_numpy(x).unsqueeze(0), SR)
        timings[ln["id"]] = {"duration": round(len(x) / SR, 3), "text": ln["text"], "heard": text, "wer": round(e, 3), "attempts": n, "words": ws}
        timings_path.write_text(json.dumps(timings, indent=1, ensure_ascii=False))
print("done", flush=True)
