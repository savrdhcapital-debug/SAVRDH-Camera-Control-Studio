# SAVRDH Camera Control Studio

Next.js camera-control application with a connected Super Admin console, shared appearance system, screen/webcam capture and direct YouTube/Facebook streaming.

## Run locally

Requires a current supported Node.js version (Node 20.9+ recommended).

```sh
npm install
npm run admin:setup
npm run dev
```

Open http://localhost:3000. The admin setup creates a private access key in `data/admin-access.txt`; use it at http://localhost:3000/admin/login. Setup is idempotent and does not replace existing credentials. Keep the entire `data/` directory and `.env.local` private. They are excluded from Git.

## Camera Studio

- `/connection`: browser webcam, compatible private-network CCAPI camera or simulated demo camera.
- `/live`, `/photo`, `/video`: live preview, exposure/focus and camera capture controls.
- `/library`: camera media browser and local organization.
- `/monitor` and `/screen`: external clean preview.
- `/appearance`: ten color themes and ten motion presets, layout, typography and effects.
- `/streaming`: screen/webcam capture, local recording and direct RTMPS broadcasting.

Apple devices use their native SF system font. Other devices use a suitable installed system font. Reduced Motion is respected. Desktop previews are bounded to the viewport; long management pages scroll within the content area.

Real-camera support depends on model, firmware, CCAPI activation and network configuration. A listed camera model is not a guarantee of compatibility. Webcam photo/video tests and demo mode are available without CCAPI hardware.

## Super Admin

- `/admin`: dashboard calculated from saved records, not sample revenue figures.
- `/admin/studio`: named SAVRDH Camera Studio module, direct app links and recent browser/camera status.
- `/admin/customers`: customer records, plans and status.
- `/admin/plans`: editable monthly plan definitions and device limits.
- `/admin/licenses`: issue and track local license keys and expiry dates.
- `/admin/models`: compatibility registry.
- `/admin/payments`: manual payment ledger.
- `/admin/tickets`: local support ticket management.
- `/admin/appearance`: the same appearance controls used by the linked application in this browser.
- `/admin/reports`, `/admin/activity`: reports, JSON export and record-change history.

Admin pages and APIs require an encrypted, HttpOnly, SameSite=Strict session using iron-session. Login attempts are rate limited. Sessions expire after eight hours. Administrator setup generates a random access key and stores its SHA-256 hash; the raw key is kept only in the private local access file. Local JSON record writes are serialized and replaced atomically.

Camera Studio sends local connection-status heartbeats to this admin workspace. This does not send email or capture media. Theme preferences are shared by the app and admin within the same browser/origin.

Plans, licenses and payments are local management records. Automatic billing, subscription renewals, client license enforcement, payment processing, cloud synchronization and email delivery are not connected. No customers, invoices or payment totals are fabricated. Initial plan definitions are drafts.

## Direct streaming

The included ffmpeg-static package must complete its binary install step. If your package manager blocks dependency install scripts, approve its official installation step and restart the server.

1. Prepare a live broadcast in YouTube or Facebook and obtain its stream key.
2. Connect your source in `/streaming`.
3. Select your destination, paste the stream key and select Start broadcast.
4. Check the platform dashboard and confirm Go Live there if required by its settings.

The local server converts ordered browser chunks to H.264/AAC at 720p/30 fps and sends RTMPS directly; no external broadcasting app is required. One destination can run at a time. Sources without audio receive a silent audio track. The app does not save stream keys in browser storage or log encoder errors containing destination URLs. A current stream key is present in the local encoder process arguments, so do not share process diagnostics while broadcasting.

Keep the browser tab and local Node server running. Leaving the module stops its source and broadcast; uploads that stop arriving time out. Browser source-audio support varies. Download local recordings before leaving the module.

## Data and deployment scope

Local records are in `data/admin-store.json`; credentials are in `data/admin-auth.json` and `data/admin-access.txt`. Existing camera configuration and library data are preserved. Back up `data/` privately before moving the installation.

This application is configured for local use. Sensitive local admin and streaming APIs accept localhost requests and reject cross-origin browser requests. A public deployment requires a separate production access/data architecture, HTTPS, host configuration and a persistent streaming runtime. Do not expose the local development server to the internet. Set `ADMIN_SECURE_COOKIE=true` when an appropriately secured HTTPS deployment is configured.

## Checks

```sh
npm run build
npx tsc --noEmit
```

Validated: production build, type checks, local encoder audio/silent-input pipelines and local RTMP transport; admin page/API authentication, record validation and persistence, cross-origin rejection and sign-out. Actual public platform playback requires a valid user-provided stream key and enabled live access.
