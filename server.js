// Serves dist/ and proxies /p/<base64url-of-server-baseurl>/api/v2/... to that server,
// dodging CORS. Run: node server.js [port]
import http from 'node:http'
import https from 'node:https'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const PORT = process.argv[2] || 5173
const DIST = new URL('./dist', import.meta.url).pathname
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json'
}

http.createServer(async (req, res) => {
  // Served under /qbit when mounted on a shared port; accept both prefixed and bare paths.
  const prefix = /^\/qbit(\/|$)/.test(req.url) ? '/qbit' : ''
  req.url = req.url.replace(/^\/qbit(\/|$)/, '/')
  const m = req.url.match(/^\/(p|pi)\/([A-Za-z0-9_-]+)(\/.*)$/)
  if (m) {
    const [, kind, b64, rest] = m
    let target
    try { target = new URL(Buffer.from(b64, 'base64url').toString() + rest) }
    catch { res.writeHead(400); return res.end('bad proxy target') }
    const mod = target.protocol === 'https:' ? https : http
    const headers = { ...req.headers, host: target.host }
    delete headers.origin
    delete headers.referer
    // /pi/ = user opted to ignore invalid TLS certs (self-signed, IP mismatch)
    const opts = { method: req.method, headers, rejectUnauthorized: kind !== 'pi' }
    const up = mod.request(target, opts, upRes => {
      const h = { ...upRes.headers }
      // Rescope cookie to this server's proxy path; drop Secure so it survives when the app itself is served over HTTP.
      if (h['set-cookie']) h['set-cookie'] = h['set-cookie'].map(c =>
        c.replace(/;\s*[Pp]ath=[^;]*/, `; Path=${prefix}/${kind}/${b64}`).replace(/;\s*[Ss]ecure/g, ''))
      res.writeHead(upRes.statusCode, h)
      upRes.pipe(res)
    })
    up.on('error', e => {
      console.error(`[proxy] ${req.method} ${target.href} -> ${e.message}`)
      res.writeHead(502)
      res.end('upstream error: ' + e.message)
    })
    req.pipe(up)
    return
  }

  // static files with SPA fallback
  let path = normalize(req.url.split('?')[0]).replace(/^(\.\.[/\\])+/, '')
  if (path === '/') path = '/index.html'
  try {
    const data = await readFile(join(DIST, path))
    const h = { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' }
    res.writeHead(200, h)
    res.end(data)
  } catch {
    const data = await readFile(join(DIST, 'index.html'))
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(data)
  }
}).listen(PORT, '0.0.0.0', () => console.log(`blackqbit serving on http://0.0.0.0:${PORT}`))
