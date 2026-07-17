# blackQbit — project memory

qBittorrent remote PWA (React + Vite). Mobile-first, bottom nav, dark default.

## Run / build

- Build: `npm run build` → `dist/`
- Serve (prod): `node server.js 5173` — serves `dist/` AND proxies API (required; vite preview breaks API calls). Not under systemd yet — dies on reboot.
- Access: `http://100.82.111.41:5173` or `https://seedbox.goblin-krait.ts.net:8443` (tailscale serve --https=8443; port 443 fronts aria2, port 10000 fronts blackAria2). Node renames kill the ts.net hostname+cert — rerun `tailscale serve --bg --https=8443 5173` after one.
- After UI change: rebuild; server.js picks up dist automatically, no restart. Restart server.js only when server.js itself changes.

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
