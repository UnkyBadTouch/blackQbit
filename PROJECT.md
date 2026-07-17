# blackQbit — project memory

qBittorrent remote PWA (React + Vite). Mobile-first, bottom nav, dark default.

## Run / build

- Build: `npm run build` → `dist/`
- Serve (prod): `node server.js 5173` — serves `dist/` AND proxies API (required; vite preview breaks API calls)
- Access: `http://100.82.111.41:5173` or `https://alpha-486a88b43e.goblin-krait.ts.net:8443` (tailscale serve --https=8443; port 443 is taken by an Apache on this box that redirects to google)
- After UI change: rebuild; server.js picks up dist automatically, no restart. Restart server.js only when server.js itself changes.

## Architecture + why

- `src/api/qbit.js` — full qBittorrent WebUI API v2 wrapper. Constructor rewrites cross-origin base URLs to `/p/<base64url>` (or `/pi/…` = skip TLS verify) because qBittorrent sends no CORS headers; a hosted PWA can only reach it via same-origin proxy.
- `server.js` — node stdlib static server + `/p|/pi` reverse proxy. Rewrites Set-Cookie: rescopes Path per server (multiple servers share one origin) and strips `Secure` (app may be served over HTTP).
- `src/store.jsx` — context: servers/theme in localStorage; polls `/sync/maindata` every 2s with rid deltas; auto-reconnects on visibility/online/focus.
- Views in `src/views/`, one per bottom-nav tab; no router, tab state in App.jsx.
- qBittorrent 5.x renamed pause/resume→stop/start: client tries new endpoint, falls back.

## Decisions / constraints (user-set)

- **Never `prompt()`/manual entry for existing values** — always pickers/action sheets; free text only for genuinely new data via inline form fields (see memory `no-manual-input-ui`).
- RSS rules must write `torrentParams` (not legacy `savePath`/`assignedCategory`/`addPaused`); legacy read as fallback on edit.
- Torrent filter/sort prefs persist in localStorage key `torrentPrefs`; search text intentionally not persisted.
- Design: "deep water" theme in `styles.css` — ink-blue bg, tabular mono for all numbers, signature segmented piece-map progress strip colored by state. Keep semantic green/amber/red for torrent states only.
- `crypto.randomUUID` unavailable over plain HTTP on LAN — don't reintroduce.
