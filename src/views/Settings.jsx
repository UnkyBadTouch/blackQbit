import React, { useEffect, useState } from 'react'
import { useStore } from '../store.jsx'
import CatTags from './CatTags.jsx'
import Prefs from './Prefs.jsx'

// qBittorrent's global cookie jar (/app/cookies) — used when fetching .torrent files
// and RSS feeds from sites that need a login cookie.
function CookieManager({ client, notify }) {
  const [cookies, setCookies] = useState(null)
  const [draft, setDraft] = useState(null) // {domain,path,name,value}

  const load = () => client.cookies().then(setCookies).catch(e => {
    setCookies([])
    notify(false, 'Cookies need qBittorrent ≥ 5.1: ' + e.message)
  })
  useEffect(() => { load() }, [client])

  const save = async (list) => {
    try {
      await client.setCookies(list)
      setCookies(list)
      notify(true, 'Cookies saved ✓')
    } catch (e) { notify(false, 'Save failed: ' + e.message) }
  }

  const add = e => {
    e.preventDefault()
    const year = Math.floor(Date.now() / 1000) + 31536000
    save([...cookies, { ...draft, path: draft.path || '/', expirationDate: year }])
    setDraft(null)
  }

  return (
    <>
      <h3>Cookies</h3>
      <p className="hint">Sent by qBittorrent when it downloads .torrent files or RSS feeds from these domains.</p>
      {cookies === null && <p className="hint">Loading…</p>}
      {cookies?.map((c, i) => (
        <div className="serverrow" key={i}>
          <div>
            <div>{c.name} <span className="hint">@ {c.domain}{c.path}</span></div>
            <div className="mono">{c.value.length > 40 ? c.value.slice(0, 40) + '…' : c.value}</div>
          </div>
          <button className="chip danger" onClick={() => save(cookies.filter((_, j) => j !== i))}>Delete</button>
        </div>
      ))}
      {cookies?.length === 0 && <p className="hint">No cookies stored.</p>}
      {draft ? (
        <form onSubmit={add} className="picker">
          <label>Domain<input required placeholder="tracker.example.org" value={draft.domain} onChange={e => setDraft({ ...draft, domain: e.target.value })} /></label>
          <label>Path<input placeholder="/" value={draft.path} onChange={e => setDraft({ ...draft, path: e.target.value })} /></label>
          <label>Name<input required placeholder="session_id" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
          <label>Value<input required value={draft.value} onChange={e => setDraft({ ...draft, value: e.target.value })} /></label>
          <div className="chiprow">
            <button className="chip on" type="submit">Add cookie</button>
            <button className="chip" type="button" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="chiprow">
          <button className="chip" onClick={() => setDraft({ domain: '', path: '/', name: '', value: '' })}>＋ Add cookie</button>
        </div>
      )}
    </>
  )
}

export default function Settings() {
  const { theme, setTheme, client, connected, servers, setServers, activeId, setActiveId, debugLog, notifPrefs, setNotifPrefs } = useStore()
  const [section, setSection] = useState(null) // 'cattags' | 'prefs' | null
  const [version, setVersion] = useState(null)
  const [toast, setToast] = useState(null)
  const notify = (ok, text) => { setToast({ ok, text }); setTimeout(() => setToast(null), 5000) }

  useEffect(() => {
    if (connected && client) client.version().then(setVersion).catch(() => {})
  }, [connected, client])

  const exportConfig = () => {
    const data = {
      app: 'blackQbit', version: 1,
      servers, activeServer: activeId, theme,
      torrentPrefs: JSON.parse(localStorage.getItem('torrentPrefs') || 'null')
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'blackqbit-config.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importConfig = async e => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!Array.isArray(data.servers)) throw new Error('Not a blackQbit config file')
      setServers(data.servers)
      if (data.servers.some(s => s.id === data.activeServer)) setActiveId(data.activeServer)
      if (data.theme === 'dark' || data.theme === 'light') setTheme(data.theme)
      if (data.torrentPrefs) localStorage.setItem('torrentPrefs', JSON.stringify(data.torrentPrefs))
      notify(true, `Imported ${data.servers.length} server(s) ✓`)
    } catch (err) { notify(false, 'Import failed: ' + err.message) }
  }

  return (
    <div className="form">
      <h2>Settings</h2>

      <h3>Appearance</h3>
      <div className="chiprow">
        <button className={'chip' + (theme === 'dark' ? ' on' : '')} onClick={() => setTheme('dark')}>Dark</button>
        <button className={'chip' + (theme === 'light' ? ' on' : '')} onClick={() => setTheme('light')}>Light</button>
      </div>

      <h3>Backup</h3>
      <div className="chiprow">
        <button className="chip" onClick={exportConfig}>⬇ Export config</button>
        <label className="chip" style={{ cursor: 'pointer' }}>
          ⬆ Import config
          <input type="file" accept=".json,application/json" onChange={importConfig} hidden />
        </label>
      </div>
      <p className="hint">Exports servers (including passwords), theme, and torrent filter settings as JSON.</p>

      <h3>Notifications</h3>
      <label className="row" style={{ gap: 8 }}>
        <input type="checkbox" checked={notifPrefs.complete} onChange={e => setNotifPrefs({ ...notifPrefs, complete: e.target.checked })} />
        Download complete
      </label>
      <label className="row" style={{ gap: 8 }}>
        <input type="checkbox" checked={notifPrefs.added} onChange={e => setNotifPrefs({ ...notifPrefs, added: e.target.checked })} />
        Download added
      </label>
      <p className="hint">Fires while the app is open (it polls the server every 2s).</p>

      {connected && <>
        <h3>Server</h3>
        <p className="hint">qBittorrent {version || '…'}</p>
        <div className="chiprow">
          <button className={'chip' + (section === 'cattags' ? ' on' : '')} onClick={() => setSection(section === 'cattags' ? null : 'cattags')}>Categories & tags</button>
          <button className={'chip' + (section === 'prefs' ? ' on' : '')} onClick={() => setSection(section === 'prefs' ? null : 'prefs')}>Preferences</button>
        </div>
        {section === 'cattags' && <CatTags notify={notify} />}
        {section === 'prefs' && <Prefs notify={notify} />}
      </>}

      {connected && <CookieManager client={client} notify={notify} />}

      <h3>Connection log</h3>
      <p className="hint">blackQbit v{__APP_VERSION__} · built {__BUILD__}</p>
      <div className="mono" style={{ whiteSpace: 'pre-wrap' }}>{debugLog.length ? debugLog.join('\n') : '(no connection attempts yet)'}</div>

      {toast && <div className={'toast ' + (toast.ok ? 'ok' : 'error')}>{toast.text}</div>}
    </div>
  )
}
