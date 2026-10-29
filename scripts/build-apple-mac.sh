#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
TASK_ROOT="$PWD"
TASK_BUILD_DIR=$(mktemp -d /tmp/savrdh-camera-build.XXXXXX)
trap 'rm -rf "$TASK_BUILD_DIR"' EXIT
APP="$TASK_BUILD_DIR/SAVRDH Camera Studio.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" build/apple/modules
cp apple/Info.plist "$APP/Contents/Info.plist"
swiftc -swift-version 5 -parse-as-library -O -target arm64-apple-macos13.0 -module-cache-path build/apple/modules apple/Sources/*.swift -o "$APP/Contents/MacOS/CameraStudio" -framework SwiftUI -framework WebKit -framework Security -framework Network
test -x build/vendor/ffmpeg || { echo "Download the pinned FFmpeg release into build/vendor first"; exit 1; }
cp build/vendor/ffmpeg "$APP/Contents/Resources/ffmpeg"
cp build/vendor/ffmpeg.LICENSE "$APP/Contents/Resources/FFmpeg-LICENSE.txt"
cp build/vendor/ffmpeg.README "$APP/Contents/Resources/FFmpeg-README.txt"
codesign --force --sign - "$APP/Contents/Resources/ffmpeg"
codesign --force --sign - "$APP"
codesign --verify --strict "$APP"
"$APP/Contents/MacOS/CameraStudio" --self-test
mkdir -p "$TASK_BUILD_DIR/installer"
cp -R "$APP" "$TASK_BUILD_DIR/installer/"
ln -s /Applications "$TASK_BUILD_DIR/installer/Applications"
hdiutil create -volname "SAVRDH Camera Studio" -srcfolder "$TASK_BUILD_DIR/installer" -ov -format UDZO "$TASK_ROOT/build/apple/SAVRDH-Camera-Studio-Mac-arm64.dmg"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$TASK_ROOT/build/apple/SAVRDH-Camera-Studio-Mac-arm64.zip"
