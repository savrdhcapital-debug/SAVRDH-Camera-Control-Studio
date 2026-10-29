#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/vendor
BASE="https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1"
# Resume interrupted transfers. A truncated download never becomes executable.
if ! test -x build/vendor/ffmpeg; then
  curl --fail --location --continue-at - --retry 2 --max-time 900 "$BASE/ffmpeg-darwin-arm64.gz" -o build/vendor/ffmpeg.gz
  gzip -t build/vendor/ffmpeg.gz
  gzip -dc build/vendor/ffmpeg.gz > build/vendor/ffmpeg.partial
  chmod 755 build/vendor/ffmpeg.partial
  build/vendor/ffmpeg.partial -version >/dev/null
  mv build/vendor/ffmpeg.partial build/vendor/ffmpeg
fi
curl --fail --location --retry 2 "$BASE/darwin-arm64.LICENSE" -o build/vendor/ffmpeg.LICENSE
curl --fail --location --retry 2 "$BASE/darwin-arm64.README" -o build/vendor/ffmpeg.README
