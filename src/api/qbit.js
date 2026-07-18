import { CapacitorHttp } from '@capacitor/core'

// Full qBittorrent WebUI API v2 client. Cookie auth (SID), form-encoded requests.
export class QbitClient {
  constructor(baseUrl, { insecure = false, timeout = 5 } = {}) {
    this.timeout = (Number(timeout) || 5) * 1000
    const base = baseUrl.replace(/\/+$/, '')
    // Native APK (CapacitorHttp) has no CORS — talk to the server directly.
    // In the browser, cross-origin servers are routed through our same-origin proxy (server.js) to avoid CORS.
    // /pi/ = proxy with TLS certificate verification disabled.
    this.native = !!globalThis.Capacitor?.isNativePlatform?.()
    // Manual session fallback: CapacitorHttp doesn't reliably replay stored cookies.
    // Cookie name varies (SID, QBT_SID_<port>, …) so keep the whole name=value pair,
    // persisted so an app restart reuses the session until the server rejects it.
    this.cookieKey = 'qbitCookie:' + base
    this.cookie = (this.native && localStorage.getItem(this.cookieKey)) || null
    if (this.native) {
      this.base = base
    } else if (typeof location !== 'undefined' && /^https?:/.test(base) && new URL(base).origin !== location.origin) {
      const b64 = btoa(base).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      this.base = import.meta.env.BASE_URL + (insecure ? 'pi/' : 'p/') + b64
    } else {
      this.base = base
    }
  }

  // Native path: call the CapacitorHttp plugin directly. The patched fetch is unusable for
  // cookie auth — its Response object filters Set-Cookie (forbidden response header), and the
  // plugin's cookie jar isn't readable via CapacitorCookies. Raw plugin results expose all headers.
  async nativeReq(path, params, opts) {
    const timeoutMs = opts.timeoutMs || this.timeout
    const isGet = opts.method === 'GET' || !params
    const url = `${this.base}/api/v2${path}` + (isGet && params ? '?' + new URLSearchParams(params) : '')
    const headers = this.cookie ? { Cookie: this.cookie } : {}
    if (!isGet) headers['Content-Type'] = 'application/x-www-form-urlencoded'
    const res = await CapacitorHttp.request({
      url,
      method: isGet ? 'GET' : 'POST',
      headers,
      data: isGet ? undefined : new URLSearchParams(params).toString(),
      connectTimeout: Math.min(timeoutMs, 15000),
      readTimeout: timeoutMs,
      responseType: 'text'
    })
    const setCookie = Object.entries(res.headers || {}).find(([k]) => k.toLowerCase() === 'set-cookie')?.[1]
    if (setCookie) this.storeCookie(String(setCookie).split(';')[0].trim())
    if (res.status === 403 || res.status === 401) throw new Error('Forbidden — session expired or IP banned')
    if (res.status < 200 || res.status >= 300) throw new Error(`${path}: HTTP ${res.status} ${res.data}`)
    if (typeof res.data !== 'string') return res.data
    try { return JSON.parse(res.data) } catch { return res.data }
  }

  async req(path, params, opts = {}) {
    if (this.native && !(params instanceof FormData)) return this.nativeReq(path, params, opts)
    const url = `${this.base}/api/v2${path}`
    const ctl = new AbortController()
    const timeoutMs = opts.timeoutMs || this.timeout
    const timer = setTimeout(() => ctl.abort(), timeoutMs)
    // Browsers forbid setting Cookie manually (and manage it themselves); native needs it explicit.
    const cookie = this.native && this.cookie ? { Cookie: this.cookie } : {}
    let res
    try {
      if (opts.method === 'GET' || !params) {
        const qs = params ? '?' + new URLSearchParams(params) : ''
        res = await fetch(url + qs, { headers: { ...cookie }, credentials: 'include', signal: ctl.signal })
      } else if (params instanceof FormData) {
        res = await fetch(url, { method: 'POST', body: params, headers: { ...cookie }, credentials: 'include', signal: ctl.signal })
      } else {
        // Plain string body: CapacitorHttp's patched fetch mangles URLSearchParams objects.
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...cookie },
          body: new URLSearchParams(params).toString(),
          credentials: 'include',
          signal: ctl.signal
        })
      }
    } catch (e) {
      if (e.name === 'AbortError') throw new Error(`Request timed out (${timeoutMs / 1000}s)`)
      throw e
    } finally {
      clearTimeout(timer)
    }
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) this.storeCookie(setCookie.split(';')[0].trim())
    if (res.status === 403) throw new Error('Forbidden — session expired or IP banned')
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${await res.text()}`)
    const text = await res.text()
    try { return JSON.parse(text) } catch { return text }
  }

  get(path, params) { return this.req(path, params, { method: 'GET' }) }
  post(path, params) { return this.req(path, params || {}) }

  // ---- Authentication ----
  storeCookie(pair) {
    if (!pair || !pair.includes('=')) return
    this.cookie = pair
    if (this.native) localStorage.setItem(this.cookieKey, pair)
  }

  async login(username, password) {
    if (this.native) { this.cookie = null; localStorage.removeItem(this.cookieKey) }
    return this.post('/auth/login', { username, password })
  }
  logout() { return this.post('/auth/logout') }

  // ---- Application ----
  version() { return this.get('/app/version') }
  cookies() { return this.get('/app/cookies') }
  setCookies(list) { return this.post('/app/setCookies', { cookies: JSON.stringify(list) }) }
  webapiVersion() { return this.get('/app/webapiVersion') }
  buildInfo() { return this.get('/app/buildInfo') }
  shutdown() { return this.post('/app/shutdown') }
  preferences() { return this.get('/app/preferences') }
  setPreferences(prefs) { return this.post('/app/setPreferences', { json: JSON.stringify(prefs) }) }
  defaultSavePath() { return this.get('/app/defaultSavePath') }
  networkInterfaceList() { return this.get('/app/networkInterfaceList') }
  networkInterfaceAddressList(iface) { return this.get('/app/networkInterfaceAddressList', { iface }) }

  // ---- Log ----
  mainLog(params) { return this.get('/log/main', params) }
  peerLog(last_known_id = -1) { return this.get('/log/peers', { last_known_id }) }

  // ---- Sync ----
  // Full maindata (rid=0) can be a large payload — give it far more than the default timeout.
  syncMaindata(rid = 0) { return this.req('/sync/maindata', { rid }, { method: 'GET', timeoutMs: 60000 }) }
  syncTorrentPeers(hash, rid = 0) { return this.get('/sync/torrentPeers', { hash, rid }) }

  // ---- Transfer ----
  transferInfo() { return this.get('/transfer/info') }
  speedLimitsMode() { return this.get('/transfer/speedLimitsMode') }
  toggleSpeedLimitsMode() { return this.post('/transfer/toggleSpeedLimitsMode') }
  downloadLimit() { return this.get('/transfer/downloadLimit') }
  setDownloadLimit(limit) { return this.post('/transfer/setDownloadLimit', { limit }) }
  uploadLimit() { return this.get('/transfer/uploadLimit') }
  setUploadLimit(limit) { return this.post('/transfer/setUploadLimit', { limit }) }
  banPeers(peers) { return this.post('/transfer/banPeers', { peers }) }

  // ---- Torrents ----
  torrents(params) { return this.get('/torrents/info', params) }
  torrentProperties(hash) { return this.get('/torrents/properties', { hash }) }
  torrentTrackers(hash) { return this.get('/torrents/trackers', { hash }) }
  torrentWebseeds(hash) { return this.get('/torrents/webseeds', { hash }) }
  torrentFiles(hash) { return this.get('/torrents/files', { hash }) }
  torrentPieceStates(hash) { return this.get('/torrents/pieceStates', { hash }) }
  torrentPieceHashes(hash) { return this.get('/torrents/pieceHashes', { hash }) }
  pause(hashes) { return this.post('/torrents/pause', { hashes }) }
  resume(hashes) { return this.post('/torrents/resume', { hashes }) }
  // qBittorrent 5.x renamed pause/resume to stop/start; try new, fall back.
  async stop(hashes) { try { return await this.post('/torrents/stop', { hashes }) } catch { return this.pause(hashes) } }
  async start(hashes) { try { return await this.post('/torrents/start', { hashes }) } catch { return this.resume(hashes) } }
  delete(hashes, deleteFiles = false) { return this.post('/torrents/delete', { hashes, deleteFiles }) }
  recheck(hashes) { return this.post('/torrents/recheck', { hashes }) }
  reannounce(hashes) { return this.post('/torrents/reannounce', { hashes }) }
  addTorrent(formData) { return this.post('/torrents/add', formData) }
  addTrackers(hash, urls) { return this.post('/torrents/addTrackers', { hash, urls }) }
  editTracker(hash, origUrl, newUrl) { return this.post('/torrents/editTracker', { hash, origUrl, newUrl }) }
  removeTrackers(hash, urls) { return this.post('/torrents/removeTrackers', { hash, urls }) }
  addPeers(hashes, peers) { return this.post('/torrents/addPeers', { hashes, peers }) }
  increasePrio(hashes) { return this.post('/torrents/increasePrio', { hashes }) }
  decreasePrio(hashes) { return this.post('/torrents/decreasePrio', { hashes }) }
  topPrio(hashes) { return this.post('/torrents/topPrio', { hashes }) }
  bottomPrio(hashes) { return this.post('/torrents/bottomPrio', { hashes }) }
  setFilePrio(hash, id, priority) { return this.post('/torrents/filePrio', { hash, id, priority }) }
  torrentDownloadLimit(hashes) { return this.post('/torrents/downloadLimit', { hashes }) }
  setTorrentDownloadLimit(hashes, limit) { return this.post('/torrents/setDownloadLimit', { hashes, limit }) }
  setShareLimits(hashes, ratioLimit, seedingTimeLimit, inactiveSeedingTimeLimit = -2) {
    return this.post('/torrents/setShareLimits', { hashes, ratioLimit, seedingTimeLimit, inactiveSeedingTimeLimit })
  }
  torrentUploadLimit(hashes) { return this.post('/torrents/uploadLimit', { hashes }) }
  setTorrentUploadLimit(hashes, limit) { return this.post('/torrents/setUploadLimit', { hashes, limit }) }
  setLocation(hashes, location) { return this.post('/torrents/setLocation', { hashes, location }) }
  rename(hash, name) { return this.post('/torrents/rename', { hash, name }) }
  setCategory(hashes, category) { return this.post('/torrents/setCategory', { hashes, category }) }
  categories() { return this.get('/torrents/categories') }
  createCategory(category, savePath = '') { return this.post('/torrents/createCategory', { category, savePath }) }
  editCategory(category, savePath) { return this.post('/torrents/editCategory', { category, savePath }) }
  removeCategories(categories) { return this.post('/torrents/removeCategories', { categories }) }
  addTags(hashes, tags) { return this.post('/torrents/addTags', { hashes, tags }) }
  removeTags(hashes, tags) { return this.post('/torrents/removeTags', { hashes, tags }) }
  tags() { return this.get('/torrents/tags') }
  createTags(tags) { return this.post('/torrents/createTags', { tags }) }
  deleteTags(tags) { return this.post('/torrents/deleteTags', { tags }) }
  setAutoManagement(hashes, enable) { return this.post('/torrents/setAutoManagement', { hashes, enable }) }
  toggleSequentialDownload(hashes) { return this.post('/torrents/toggleSequentialDownload', { hashes }) }
  toggleFirstLastPiecePrio(hashes) { return this.post('/torrents/toggleFirstLastPiecePrio', { hashes }) }
  setForceStart(hashes, value) { return this.post('/torrents/setForceStart', { hashes, value }) }
  setSuperSeeding(hashes, value) { return this.post('/torrents/setSuperSeeding', { hashes, value }) }
  renameFile(hash, oldPath, newPath) { return this.post('/torrents/renameFile', { hash, oldPath, newPath }) }
  renameFolder(hash, oldPath, newPath) { return this.post('/torrents/renameFolder', { hash, oldPath, newPath }) }
  exportTorrent(hash) { return this.get('/torrents/export', { hash }) }

  // ---- RSS ----
  rssAddFolder(path) { return this.post('/rss/addFolder', { path }) }
  rssAddFeed(url, path = '') { return this.post('/rss/addFeed', { url, path }) }
  rssRemoveItem(path) { return this.post('/rss/removeItem', { path }) }
  rssMoveItem(itemPath, destPath) { return this.post('/rss/moveItem', { itemPath, destPath }) }
  rssItems(withData = false) { return this.get('/rss/items', { withData }) }
  rssMarkAsRead(itemPath, articleId) { return this.post('/rss/markAsRead', articleId != null ? { itemPath, articleId } : { itemPath }) }
  rssRefreshItem(itemPath) { return this.post('/rss/refreshItem', { itemPath }) }
  rssSetRule(ruleName, ruleDef) { return this.post('/rss/setRule', { ruleName, ruleDef: JSON.stringify(ruleDef) }) }
  rssRenameRule(ruleName, newRuleName) { return this.post('/rss/renameRule', { ruleName, newRuleName }) }
  rssRemoveRule(ruleName) { return this.post('/rss/removeRule', { ruleName }) }
  rssRules() { return this.get('/rss/rules') }
  rssMatchingArticles(ruleName) { return this.get('/rss/matchingArticles', { ruleName }) }

  // ---- Search ----
  searchStart(pattern, plugins = 'all', category = 'all') { return this.post('/search/start', { pattern, plugins, category }) }
  searchStop(id) { return this.post('/search/stop', { id }) }
  searchStatus(id) { return this.get('/search/status', id != null ? { id } : undefined) }
  searchResults(id, limit = 0, offset = 0) { return this.get('/search/results', { id, limit, offset }) }
  searchDelete(id) { return this.post('/search/delete', { id }) }
  searchPlugins() { return this.get('/search/plugins') }
  searchInstallPlugin(sources) { return this.post('/search/installPlugin', { sources }) }
  searchUninstallPlugin(names) { return this.post('/search/uninstallPlugin', { names }) }
  searchEnablePlugin(names, enable) { return this.post('/search/enablePlugin', { names, enable }) }
  searchUpdatePlugins() { return this.post('/search/updatePlugins') }
}
