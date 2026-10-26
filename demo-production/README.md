# Demo video production

A product showcase of the AICTE Demo Website, produced from the real running app. Every frame inside the app is a screen recording of genuine interactions on a freshly reset demo database with synthetic accounts. The edit only adds overlays: chapter cards, zooms, spotlights, callouts, subtitles, sound.

| Output | Length | File |
|---|---|---|
| Main cut, 1920×1080, 30 fps, H.264/AAC, −16 LUFS, chapter markers | ≈ 5:50 | `out/aicte-demo-main.mp4` (not committed: ~95 MB; run `./render.sh`) |
| Short cut (fair clock, yearly rules, trust) | ≈ 2:30 | `out/aicte-demo-short.mp4` |
| Subtitles (same text and timing as the burned-in ones) | | `out/main.srt`, `out/short.srt` |
| Chapter list for YouTube | | `out/main.chapters.txt` |

## What is here

| Path | What it is |
|---|---|
| `FEATURE_INVENTORY.md` | Phase 1 audit: architecture and every feature with route, role, test steps, success condition and verification status. |
| `STORYBOARD.md` | Chapters, each in the pattern purpose → real interaction → verified result → takeaway, and how the six editing principles are applied. |
| `PLAN.md` | Execution plan and stages. |
| `narration/script.json` | Narration text per chapter and part (A purpose, B interaction, C result, D takeaway), with an emotion level per line. |
| `narration/audio/` | One WAV per line + `timings.json` (duration, what speech-to-text heard, word error rate, word timings). |
| `narration/samples/` | The voice comparison (Kokoro and Chatterbox) used to choose the voice. |
| `audio/sfx/` | Synthesised, licence-free sounds: click, key taps, whoosh, pop, chime, soft "refused" tone, riser, music bed (`automation/make_sfx.py`). |
| `automation/lib/recorder.mjs` | Recorder: Chrome screencast frames → constant-rate MP4, injected cursor with click ripple, and a log of every click, keystroke, upload, result and narration cue. |
| `automation/record.mjs` | The nine chapter scenarios. Each step asserts the real outcome on screen or through the API; a failed assertion stops the recording. |
| `automation/narrate.py` | Chatterbox narration with breath pauses between sentences; each line is transcribed with faster-whisper and regenerated if it does not match the script. |
| `automation/build-timeline.mjs` | Edit decisions from the logs: 1× while the voice speaks and around results, faster through typing and loading (shown with a speed badge). |
| `automation/make-srt.mjs` | Subtitles, chapter list and MP4 chapter metadata from the same timeline. |
| `recordings/<ch>/` | Raw recordings (`<ch>.mp4`) and event logs (`<ch>.events.json`), plus `state.json` (the case filed in chapter 2). |
| `remotion/` | Remotion 4 project (React/TypeScript): `Main` and `Short` compositions. |
| `render.sh` | One command for everything. |

## Render

```bash
# Prerequisites: the local stack running (npm run dev, two schedulers), ffmpeg, Chromium (Playwright's).
cd demo-production/remotion && npm install && cd ..
./render.sh                 # edit and render both cuts from the existing recordings and narration
./render.sh --record        # re-record all chapters first (resets the demo database)
./render.sh --narrate       # regenerate the narration first (Chatterbox, CPU, about 25 minutes)
./render.sh main            # only the main cut
```

Narration setup (once): a Python 3.13 virtualenv with `torch==2.6.0 torchaudio==2.6.0 chatterbox-tts faster-whisper "setuptools<81"`; point `TTS_PY` at its `python`. Chatterbox downloads its model from Hugging Face on first use.

Preview and fine-tune in Remotion Studio: `cd remotion && npx remotion studio`.

## How the editing principles are implemented

1. **Guide the viewer's eyes.** The camera eases toward each element just before it is used and toward each verified result, then eases back out (`remotion/src/camera.ts`). Results get a spotlight that dims the rest of the screen.
2. **Show where you are.** A bottom band shows the chapter number and title, a progress bar of all chapters, who is signed in, and the prototype disclaimer. A banner appears whenever the signed-in person changes.
3. **Show cause and effect.** When a result appears, a dotted arrow runs from the click that caused it to the change, and a callout names the outcome (green for success, red for a refusal or block).
4. **Explain alongside the interface.** Subtitles with word-by-word highlighting, and short callouts placed next to the element, never over the field in use.
5. **Make interactions readable.** Visible cursor with click ripples (in the footage), an extra click pulse after zooming, a "Typing · field" chip, a "file attached" chip, clear click and key sounds, a speed badge whenever time is compressed.
6. **Organise into chapters.** Nine chapter cards, chapter markers inside the MP4, and a chapter list for YouTube.

## Honesty notes

- No interaction is simulated or drawn: every on-screen action is a real click or keystroke in the running app, and every callout points at text the app itself displayed.
- Time compression is visible (speed badge), never hidden.
- Time travel and the tampering step are demo tools and are labelled as such. The terminal card shows the exact command and its real output.
- The form-check model is shown in its real state ("Model unavailable: rules only" when the Python service is not running); the narration does not claim more.
- Synthetic data only; no real people, institutions or credentials. Rule values are placeholders.
