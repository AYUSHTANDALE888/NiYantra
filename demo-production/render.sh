#!/usr/bin/env bash
# One command for the whole demo video:  ./render.sh [--record] [--narrate] [main|short|all]
#   --narrate  regenerate the narration (Chatterbox + verification), needs ../.venv-tts (see README)
#   --record   re-record every chapter from the running local app (npm run dev + schedulers), after a demo reset
# Then: master the narration → build the edit timeline → compose music to each cut's length → render with Remotion
#       → chapter markers + two-pass loudness (-16 LUFS, peaks limited at -1.5 dB) → out/*.mp4
set -euo pipefail
cd "$(dirname "$0")"
PROD=$(pwd)
CUTS=all; NARRATE=0; RECORD=0
for a in "$@"; do case $a in --narrate) NARRATE=1;; --record) RECORD=1;; main|short|all) CUTS=$a;; esac; done
TTS_PY=${TTS_PY:-/tmp/claude-0/cbx/venv/bin/python}
BROWSER=${REMOTION_BROWSER:-/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell}

if [ $NARRATE = 1 ]; then "$TTS_PY" -I automation/narrate.py narration/script.json narration/audio; fi
if [ $RECORD = 1 ]; then (cd automation && NODE_PATH=${NODE_PATH:-/opt/node22/lib/node_modules} node record.mjs); fi

# Media for the Remotion project (copies, git-ignored there).
P=remotion/public; mkdir -p $P/recordings $P/narration $P/sfx
for d in recordings/ch*/; do c=$(basename "$d"); cp "$d/$c.mp4" $P/recordings/; done
python3 -I automation/master_voice.py narration/audio $P/narration; cp audio/sfx/* $P/sfx/
node automation/build-timeline.mjs
node automation/make-srt.mjs
mkdir -p out
for cut in main short; do
  dur=$(node -p "require('./remotion/src/data/timeline.json').$cut.duration")
  python3 -I automation/make_music.py "$dur" "out/music-$cut.wav"
  ffmpeg -loglevel error -y -i "out/music-$cut.wav" -c:a libopus -b:a 192k "$P/sfx/music-$cut.opus" && rm -f "out/music-$cut.wav"
done
render() { # $1 composition, $2 cut name
  (cd remotion && npx remotion render "$1" "../out/$2.raw.mp4" --browser-executable="$BROWSER" --concurrency=${CONCURRENCY:-4} --codec=h264 --crf=18 --audio-codec=aac --audio-bitrate=192k --log=error)
  # Loudness in two passes: measure, then one linear gain to -16 LUFS with a transparent peak limiter at -1.5 dB
  # (no dynamic loudness riding, so the ducking and the voice keep their shape). Chapter markers; video copied.
  local i; i=$(ffmpeg -hide_banner -nostats -i "out/$2.raw.mp4" -af loudnorm=print_format=json -f null - 2>&1 | python3 -c "import sys,re,json; print(json.loads(re.search(r'\{[^{}]*\}', sys.stdin.read()).group(0))['input_i'])")
  local gain; gain=$(python3 -c "print(round(-16 - $i, 2))")
  ffmpeg -loglevel error -y -i "out/$2.raw.mp4" -i "out/$2.ffmeta" -map 0 -map_metadata 1 -map_chapters 1 -c:v copy -af "volume=${gain}dB,alimiter=limit=0.84:attack=3:release=60:level=false" -ar 48000 -c:a aac -b:a 192k -movflags +faststart "out/aicte-demo-$2.mp4"
  rm -f "out/$2.raw.mp4"
  echo "out/aicte-demo-$2.mp4"
}
if [ $CUTS = main ] || [ $CUTS = all ]; then render Main main; fi
if [ $CUTS = short ] || [ $CUTS = all ]; then render Short short; fi
