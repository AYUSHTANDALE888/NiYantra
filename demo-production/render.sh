#!/usr/bin/env bash
# One command for the whole demo video:  ./render.sh [--record] [--narrate] [main|short|all]
#   --narrate  regenerate the narration (Chatterbox + verification), needs ../.venv-tts (see README)
#   --record   re-record every chapter from the running local app (npm run dev + schedulers), after a demo reset
# Then: build the edit timeline → render with Remotion → add chapter markers, normalise loudness → out/*.mp4
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
cp narration/audio/*.wav $P/narration/; cp audio/sfx/* $P/sfx/
node automation/build-timeline.mjs
node automation/make-srt.mjs
mkdir -p out
render() { # $1 composition, $2 cut name
  (cd remotion && npx remotion render "$1" "../out/$2.raw.mp4" --browser-executable="$BROWSER" --concurrency=${CONCURRENCY:-4} --codec=h264 --crf=18 --audio-codec=aac --audio-bitrate=192k --log=error)
  # Chapter markers + loudness (-16 LUFS, true peak -1.5 dB) in one pass; video is copied, not re-encoded.
  ffmpeg -loglevel error -y -i "out/$2.raw.mp4" -i "out/$2.ffmeta" -map 0 -map_metadata 1 -map_chapters 1 -c:v copy -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a aac -b:a 192k -movflags +faststart "out/aicte-demo-$2.mp4"
  rm -f "out/$2.raw.mp4"
  echo "out/aicte-demo-$2.mp4"
}
[ $CUTS = main ] || [ $CUTS = all ] && render Main main
[ $CUTS = short ] || [ $CUTS = all ] && render Short short
