#!/usr/bin/env bash
# Poster frames for the landing: one still per flagship render (docs/renders/<slug>-flagship.mp4 -> public/showcase/posters/<slug>.jpg),
# so no video tile is ever blank before it plays. Re-run after Lane A re-renders a flagship. A frame of our own video, nothing generated.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
FF="$(node -e "process.stdout.write(require('ffmpeg-static'))")"
mkdir -p public/showcase/posters
for f in docs/renders/*-flagship.mp4; do
  slug="$(basename "$f" -flagship.mp4)"
  "$FF" -v error -y -ss 1.0 -i "$f" -frames:v 1 -vf "scale=400:-2" -q:v 5 "public/showcase/posters/$slug.jpg"
  echo "public/showcase/posters/$slug.jpg"
done
