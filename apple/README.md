# SAVRDH Camera Studio for Mac

Native macOS app with the existing hosted studio interface and a local camera
bridge. Designed for Apple Silicon Macs running macOS 13 or later. An internet
connection is required to load the UI, sign in, and validate approved access.
This is a development build with ad-hoc signing, not an Apple-notarized release.
No iPad binary is included in this Mac release.

## Install and connect

1. Open `SAVRDH-Camera-Studio-Mac-arm64.dmg` and drag the app to Applications.
2. Connect this Mac and the camera to the same Wi-Fi router. Avoid isolated guest
   networks. Allow the app's Local Network permission when macOS asks.
3. Sign in with an approved Camera Studio account or Camera Studio administrator.
4. Canon: turn on Camera Control API (CCAPI), keep the camera awake, then choose
   Find camera. The connection screen scans automatically. One unauthenticated
   camera connects automatically; multiple cameras require selection. Protected
   devices require selection and their own camera login.
5. If Canon CCAPI asks for credentials, use Camera Access in the native toolbar.
   Enter the camera IP and its CCAPI login. These credentials are sent only to
   that exact private IP and stored in this Mac's Keychain. They are not your
   Studio account credentials.
6. CCTV: choose CCTV Cameras. Select Find ONVIF cameras, choose a result, enter
   its local login, and save. Or select RTSP and enter the camera's documented
   local stream URL. HTTP JPEG/PNG snapshot URLs are also supported.

Canon discovery scans port 8080 on up to four connected private /24 subnets,
with 24 simultaneous probes. If the camera uses a different port, enter it
manually. Reconnection can find a saved Canon camera by its serial number if
DHCP changes its IP. The app never silently switches to an unrelated camera.

CCTV ONVIF uses WS-Discovery, then GetCapabilities/GetProfiles/GetStreamUri.
Manual ONVIF addresses are also supported. At most 32 CCTV entries can be saved,
with up to four RTSP previews at once. FFmpeg is bundled; no separate player or
OBS installation is required for CCTV preview. Previews do not record footage.
RTSP preview is video only, at up to 4 fps and 960-pixel width. This is a monitoring
preview, not a full-resolution NVR recording system.

Camera names and credential-free stream URLs are stored in
`~/Library/Application Support/SAVRDH Camera Studio/cctv.json`.
CCTV passwords are stored only in Apple Keychain, separate from the JSON file.
Cloud application databases do not receive these credentials or camera frames.
Credentials for RTSP decoding are provided to the bundled local decoder; they
are never logged by the application. Protect access to the Mac account.

## Compatibility limits

- The camera must actually support and enable CCAPI, ONVIF, RTSP, or an HTTP
  snapshot service. A phone-app device ID is not a video stream URL.
- Manufacturer-only/encrypted cloud camera protocols are not decoded here.
- HTTP snapshots must return JPEG/PNG. ONVIF Media 1 profiles are supported;
  Media 2-only cameras may need their manual RTSP URL.
- Hardware communication is IPv4/private LAN only. Public-IP destinations,
  embedded URL credentials and external ONVIF service addresses are rejected.
- HTTP camera redirects are not followed. TLS certificate validation is retained.
- Photo previews/transfers use a 32 MB response limit. Large recordings should
  be transferred directly from the camera. Full-res RTSP recording, PTZ/talkback
  and manufacturer cloud playback are not implemented in this release.
- The Mac and the camera should remain on a network that also provides internet.
  Fully offline operation on a camera-only Wi-Fi hotspot is not supported.
- Apple signing/notarization and tests against physical cameras are still
  required before treating the app as a production customer release.

## Build

Run `npm ci --ignore-scripts`, then `bash scripts/fetch-apple-decoder.sh` and
`bash scripts/build-apple-mac.sh`. Builds are staged under a temporary directory
so File Provider metadata does not contaminate code signing. The DMG and ZIP
are written under `build/apple/`. The included decoder is pinned to the
ffmpeg-static b6.1.1 macOS arm64 release. Its upstream README and license are
bundled in app Resources; see the source and build instructions there.

The native binary has a `--self-test` option that runs 25 private-address and XML
checks without contacting any camera. The app's website source must also be
published for the new CCTV and native-connection interface to appear.
