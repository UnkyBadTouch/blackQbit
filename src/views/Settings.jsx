import React, { useEffect, useState } from 'react'
import { useStore } from '../store.jsx'

const PREF_FIELDS = [
  ['Downloads', [
    ['save_path', 'Default save path', 'text'],
    ['temp_path_enabled', 'Use incomplete folder', 'bool'],
    ['temp_path', 'Incomplete folder', 'text'],
    ['start_paused_enabled', 'Add torrents stopped', 'bool']
  ]],
  ['Connection', [
    ['listen_port', 'Listen port', 'number'],
    ['random_port', 'Random port', 'bool'],
    ['upnp', 'UPnP / NAT-PMP', 'bool'],
    ['max_connec', 'Max connections', 'number'],
    ['max_connec_per_torrent', 'Max connections per torrent', 'number']
  ]],
  ['Queueing', [
    ['queueing_enabled', 'Enable queueing', 'bool'],
    ['max_active_downloads', 'Max active downloads', 'number'],
    ['max_active_uploads', 'Max active uploads', 'number'],
    ['max_active_torrents', 'Max active torrents', 'number']
  ]],
  ['Seeding', [
    ['max_ratio_enabled', 'Limit share ratio', 'bool'],
    ['max_ratio', 'Max ratio', 'number'],
    ['max_seeding_time_enabled', 'Limit seeding time', 'bool'],
    ['max_seeding_time', 'Max seeding time (min)', 'number']
  ]],
  ['Alternative speed limits', [
    ['alt_dl_limit', 'Alt download limit (KiB/s)', 'number'],
    ['alt_up_limit', 'Alt upload limit (KiB/s)', 'number'],
    ['scheduler_enabled', 'Schedule alt limits', 'bool']
  ]]
]

export default function Settings() {
  const { theme, setTheme, client, connected, categories, tags, servers, setServers, activeId, setActiveId } = useStore()
  const [version, setVersion] = useState(null)
  const [prefs, setPrefs] = useState(null)
  const [dirty, setDirty] = useState({})
  const [showPrefs, setShowPrefs] = useState(false)
  const [toast, setToast] = useState(null)
  const notify = (ok, text) => { setToast({ ok, text }); setTimeout(() => setToast(null), 5000) }

  useEffect(() => {
    if (connected && client) client.version().then(setVersion).catch(() => {})
  }, [connected, client])

  const openPrefs = async () => {
    try { setPrefs(await client.preferences()); setDirty({}); setShowPrefs(true) }
    catch (e) { notify(false, e.message) }
  }

  const savePrefs = async () => {
    try {
      await client.setPreferences(dirty)
      notify(true, 'Preferences saved ✓')
      setPrefs({ ...prefs, ...dirty }); setDirty({})
    } catch (e) { notify(false, e.message) }
  }

  const val = k => (k in dirty ? dirty[k] : prefs?.[k])

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

      {connected && <>
        <h3>Categories</h3>
        <div className="chiprow">
          {Object.entries(categories).map(([name, c]) => (
            <button key={name} className="chip" onClick={async () => {
              if (confirm(`Delete category "${name}"?`)) await client.removeCategories(name)
            }}>{name} ✕</button>
          ))}
          <button className="chip on" onClick={async () => {
            const name = prompt('New category name:')
            if (!name) return
            const path = prompt('Save path (optional):') || ''
            await client.createCategory(name, path)
          }}>＋ New</button>
        </div>

        <h3>Tags</h3>
        <div className="chiprow">
          {tags.map(t => (
            <button key={t} className="chip" onClick={async () => {
              if (confirm(`Delete tag "${t}"?`)) await client.deleteTags(t)
            }}>{t} ✕</button>
          ))}
          <button className="chip on" onClick={async () => {
            const t = prompt('New tag(s), comma separated:')
            if (t) await client.createTags(t)
          }}>＋ New</button>
        </div>

        <h3>Server</h3>
        <p className="hint">qBittorrent {version || '…'}</p>

        <h3>Preferences</h3>
        {!showPrefs && <button onClick={openPrefs}>Edit qBittorrent preferences</button>}
        {showPrefs && prefs && <>
          {PREF_FIELDS.map(([section, fields]) => (
            <React.Fragment key={section}>
              <h3>{section}</h3>
              {fields.map(([key, label, type]) => type === 'bool' ? (
                <label key={key} className="row">
                  <input type="checkbox" checked={!!val(key)}
                    onChange={e => setDirty(d => ({ ...d, [key]: e.target.checked }))} />
                  {label}
                </label>
              ) : (
                <label key={key}>{label}
                  <input type={type} value={val(key) ?? ''}
                    onChange={e => setDirty(d => ({ ...d, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))} />
                </label>
              ))}
            </React.Fragment>
          ))}
          <div className="chiprow">
            <button className="primary" disabled={!Object.keys(dirty).length} onClick={savePrefs}>
              Save {Object.keys(dirty).length ? `(${Object.keys(dirty).length} changed)` : ''}
            </button>
            <button onClick={() => setShowPrefs(false)}>Close</button>
          </div>
        </>}
      </>}

      {toast && <div className={'toast ' + (toast.ok ? 'ok' : 'error')}>{toast.text}</div>}

      <p className="hint">blackqbit · installable PWA — use your browser's "Add to Home Screen".</p>
    </div>
  )
}
