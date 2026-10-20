#!/bin/bash
# Double-click to start the local preview, then open the site.
cd "$(dirname "$0")"
PORT=8765
if ! lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 &
  sleep 1
fi
open "http://127.0.0.1:$PORT/index.html"
echo "Site running at http://127.0.0.1:$PORT/index.html"
echo "Keep this window open. Close it to stop the preview."
wait
