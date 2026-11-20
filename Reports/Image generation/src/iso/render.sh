#!/usr/bin/env bash
# usage: render.sh <name> [width]  -> builds src/iso/<name>.mjs and captures the review PNG into the scratchpad
set -e
export PATH="/c/Users/PC-05/tools/node-v22.11.0-win-x64:$PATH"
export CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"
ROOT="/c/dev/Aerofusion-MP(Group 40)/AeroFusion-MP/Reports/Image generation"
SHOTS="/c/Users/PC-05/AppData/Local/Temp/claude/159320d11e926f46/abc93ac4-6a3e-4269-843f-d800e281dac5/scratchpad/shots"
mkdir -p "$SHOTS"
cd "$ROOT"
node "src/iso/$1.mjs"
node "Skills/anatomy-main/anatomy-main/scripts/capture.mjs" "Final images/components/$1.html" --out "$SHOTS/$1.png" --width "${2:-1000}" --scale 1 2>&1 | tail -2
