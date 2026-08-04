import React, { useState } from 'react'
import { useStore } from '../store.jsx'

export default function Settings() {
  const { theme, setTheme, servers, setServers, activeId, setActiveId, debugLog, notifPrefs, setNotifPrefs, updateCheckPref, setUpdateCheckPref } = useStore()
  const [toast, setToast] = useState(null)
  const notify = (ok, text) => { setToast({ ok, text }); setTimeout(() => setToast(null), 5000) }

  const exportConfig = async () => {
    const data = {
      app: 'blackQbit', version: 1,
      servers, activeServer: activeId, theme,
      torrentPrefs: JSON.parse(localStorage.getItem('torrentPrefs') || 'null')
    }
    const json = JSON.stringify(data, null, 2)
    const filename = 'blackQbit.json'
    // Android WebView doesn't support the <a download> trick — write to cache and hand off
    // to the native share sheet so the user can pick where to save it.
    if (globalThis.Capacitor?.isNativePlatform?.()) {
      try {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
        const { Share } = await import('@capacitor/share')
        const { uri } = await Filesystem.writeFile({ path: filename, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 })
        await Share.share({ title: 'blackQbit config', url: uri, dialogTitle: `Save ${filename}` })
      } catch (e) { notify(false, 'Export failed: ' + e.message) }
      return
    }
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
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

      <h3>Updates</h3>
      <div className="chiprow">
        <button className={'chip' + (updateCheckPref === 'never' ? ' on' : '')} onClick={() => setUpdateCheckPref('never')}>Never</button>
        <button className={'chip' + (updateCheckPref === 'week' ? ' on' : '')} onClick={() => setUpdateCheckPref('week')}>Every week</button>
        <button className={'chip' + (updateCheckPref === '2weeks' ? ' on' : '')} onClick={() => setUpdateCheckPref('2weeks')}>Every 2 weeks</button>
      </div>
      <p className="hint">Checked once when the app is launched fresh, not each time you switch back in.</p>

      <h3>Connection log</h3>
      <p className="hint">blackQbit v{__APP_VERSION__} · built {__BUILD__}</p>
      <div className="mono" style={{ whiteSpace: 'pre-wrap' }}>{debugLog.length ? debugLog.join('\n') : '(no connection attempts yet)'}</div>

      {toast && <div className={'toast ' + (toast.ok ? 'ok' : 'error')}>{toast.text}</div>}
    </div>
  )
}
