# blackQbit — project memory

qBittorrent remote PWA (React + Vite). Mobile-first, bottom nav, dark default.

## Run / build

- Build: `npm run build` → `dist/`
- Primary distribution (2026-07): **Android APK via Capacitor** — `CAP_BUILD=1 npm run build && npx cap sync android`, then in `android/`: `./gradlew assembleDebug`; output copied to `blackQbit-v{versionName}.{versionCode}.apk` at repo root (served via `~/www` symlink — repoint it to the new filename each release). CAP_BUILD=1 mandatory — without it assets point at `/qbit/` and the APK loads broken. No env vars since 2026-07-20: JDK 25 via `org.gradle.java.home` in android/gradle.properties (system java 27-ea unsupported), SDK via android/local.properties. Gradle 9.5.1 + 1GB heap caps (2GB box OOMs otherwise; free RAM first, dexing is the killer). CapacitorHttp patches fetch natively → no CORS, talks straight to qBittorrent; use the LE cert's domain, not the IP.
- Naming (2026-08-04): APK is `blackQbit-v{versionName}.{versionCode}.apk`, not `blackQbit-debug.apk` — kept distinct from the unrelated `~/blackAria2` project's own `blackAria2-*.apk`. Not committed to GitHub (gitignored, `~/www`-served only), unlike blackAria2 where the APK is tracked in the repo.
- `@capacitor/filesystem` + `@capacitor/share` (added 2026-07-28) pin `kotlin { jvmToolchain(21) }`, which JDK 25 can't satisfy on its own (Gradle toolchain matching is exact-major-version). Fixed via `org.gradle.toolchains.foojay-resolver-convention` (must be **1.0.0+** — 0.8.0 references `JvmVendorSpec.IBM_SEMERU`, removed in Gradle 9) in `android/settings.gradle`, which auto-downloads a matching JDK 21 into `~/.gradle/jdks` on first build (needs network, one-time ~5min). Any future plugin pinning its own `jvmToolchain` relies on this same resolver.
- Versioning: each update bump `npm pkg set version=x.y.z` AND versionCode/versionName in `android/app/build.gradle` (unchanged versionCode → Android may keep the old install). Settings footer shows `v{__APP_VERSION__} · built {__BUILD__}` (vite defines).
- Background notifications: foreground service (`@capawesome-team/capacitor-android-foreground-service`, dataSync type, wired in `src/notify.js`) runs while any torrent is in a `*DL`/downloading state so the 2s poll keeps firing when backgrounded; if notifications still die, exempt the app from battery optimization on the phone.
- Web/PWA hosting (node server.js + tailscale serve) was retired 2026-07-18 — user wants client-only apps, no always-on servers, no tailscale dependency. server.js kept for dev/browser use: `node server.js 5173` serves dist + CORS/TLS proxy (/p/, /pi/; cookie paths get /qbit prefix when mounted under one).

## Architecture + why

- `src/api/qbit.js` — full qBittorrent WebUI API v2 wrapper. Constructor rewrites cross-origin base URLs to `/p/<base64url>` (or `/pi/…` = skip TLS verify) because qBittorrent sends no CORS headers; a hosted PWA can only reach it via same-origin proxy. Per-server request timeout (AbortController, default 5s).
- `server.js` — node stdlib static server + `/p|/pi` reverse proxy. Rewrites Set-Cookie: rescopes Path per server (multiple servers share one origin) and strips `Secure` (app may be served over HTTP). Logs upstream errors to stderr.
- `src/store.jsx` — context: servers/theme in localStorage; polls `/sync/maindata` every 2s with rid deltas; auto-reconnects on visibility/online/focus. Connect reuses existing SID (probes `/app/version`) and only logs in on failure — qBittorrent IP-bans after repeated logins.
- Views in `src/views/`, one per bottom-nav tab; no router, tab state in App.jsx. Servers tab also hosts the category/tag manager (`CatTags.jsx`) and qBittorrent preferences editor (`Prefs.jsx`).
- qBittorrent 5.x renamed pause/resume→stop/start: client tries new endpoint, falls back.
- Persisted localStorage keys: `servers`, `activeServer`, `theme`, `tab`, `torrentPrefs` (filter/sort), `rssView`, `rssEditingRule`, `rssRuleDraft` (rule form survives refresh).

## Decisions / constraints (user-set)

- **Never `prompt()`/manual entry for existing values** — always pickers/action sheets; free text only for genuinely new data via inline form fields (see memory `no-manual-input-ui`).
- RSS rules must write `torrentParams` (not legacy `savePath`/`assignedCategory`/`addPaused`); legacy read as fallback on edit.
- UI state (filters, sort, tab, RSS sub-view/editor) must survive page reload; search text intentionally not persisted.
- Design: "deep water" theme in `styles.css` — ink-blue bg, tabular mono for all numbers, signature segmented piece-map progress strip colored by state, live-speed top bar. Keep semantic green/amber/red for torrent states only.
- `crypto.randomUUID` unavailable over plain HTTP on LAN — don't reintroduce.
