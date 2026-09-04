// Background Runner (native, headless — no DOM, no app JS). Runs every 15 min (Android
// minimum) even if the WebView's own timers are frozen while backgrounded. Fallback only:
// the main app's own polling already notifies in real time whenever it's actually running.
const isDone = (s) => !!s && (/UP$/.test(s) || s === 'uploading')

// Main app calls this (via BackgroundRunner.dispatchEvent) whenever the active server,
// session cookie, or notification preference changes, so the periodic run below has
// something current to work with. State is not kept between runner invocations otherwise.
addEventListener('configUpdate', (resolve, reject, args) => {
  try {
    if (args.serverUrl) CapacitorKV.set('serverUrl', args.serverUrl)
    else CapacitorKV.remove('serverUrl')
    if (args.cookie) CapacitorKV.set('cookie', args.cookie)
    else CapacitorKV.remove('cookie')
    CapacitorKV.set('notifComplete', args.notifComplete ? '1' : '0')
    resolve()
  } catch (err) {
    reject(err)
  }
})

addEventListener('check', (resolve, reject) => {
  (async () => {
    try {
      const serverUrl = CapacitorKV.get('serverUrl').value
      const cookie = CapacitorKV.get('cookie').value
      const notifComplete = CapacitorKV.get('notifComplete').value
      if (!serverUrl || !cookie || notifComplete !== '1') { resolve(); return }

      const res = await fetch(serverUrl + '/api/v2/sync/maindata?rid=0', { headers: { Cookie: cookie } })
      if (!res.ok) { resolve(); return } // stale cookie etc — main app will refresh on next open

      const data = JSON.parse(await res.text())
      const torrents = data.torrents || {}
      const prevPendingRaw = CapacitorKV.get('pendingHashes').value
      const prevPending = prevPendingRaw ? JSON.parse(prevPendingRaw) : null

      if (prevPending) {
        let notifyId = Math.floor(Date.now() / 1000) % 100000
        for (const hash of prevPending) {
          const t = torrents[hash]
          if (t && isDone(t.state)) {
            CapacitorNotifications.schedule([{ id: notifyId++, title: t.name || 'Torrent', body: 'Download complete', channelId: 'downloads_silent' }])
          }
        }
      }

      const pending = Object.entries(torrents).filter(([, t]) => !isDone(t.state)).map(([h]) => h)
      CapacitorKV.set('pendingHashes', JSON.stringify(pending))
      resolve()
    } catch (err) {
      reject(err)
    }
  })()
})
