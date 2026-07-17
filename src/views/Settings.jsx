import React, { useEffect, useState } from 'react'
import { useStore } from '../store.jsx'

export default function Settings() {
  const { theme, setTheme, client, connected, categories, tags, servers, setServers, activeId, setActiveId } = useStore()
  const [version, setVersion] = useState(null)
  const [toast, setToast] = useState(null)
  const [editCat, setEditCat] = useState(null)
  const [catPath, setCatPath] = useState('')
  const [newCat, setNewCat] = useState('')
  const [newCatPath, setNewCatPath] = useState('')
  const [newTag, setNewTag] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)
  const notify = (ok, text) => { setToast({ ok, text }); setTimeout(() => setToast(null), 5000) }
  const run = async fn => {
    try { await fn() } catch (e) { notify(false, e.message) }
    setConfirmDel(null)
  }

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

      {connected && <>
        <h3>Categories</h3>
        {Object.entries(categories).map(([name, c]) => (
          <div key={name} className="serverrow">
            <div onClick={() => { setEditCat(editCat === name ? null : name); setCatPath(c.savePath || '') }}>
              <div className="tname">{name}</div>
              <div className="tmeta"><span className="mono">{c.savePath || 'default path'}</span></div>
            </div>
            {confirmDel === 'cat:' + name
              ? <button className="danger" onClick={async () => { await run(() => client.removeCategories(name)) }}>Confirm?</button>
              : <button className="danger" onClick={() => setConfirmDel('cat:' + name)}>✕</button>}
          </div>
        ))}
        {editCat && (
          <div className="pwrow">
            <input value={catPath} onChange={e => setCatPath(e.target.value)} placeholder={`Save path for "${editCat}"`} />
            <button className="primary" onClick={async () => {
              await run(() => client.editCategory(editCat, catPath)); setEditCat(null)
            }}>Save</button>
          </div>
        )}
        <div className="pwrow">
          <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="New category name" />
          <input value={newCatPath} onChange={e => setNewCatPath(e.target.value)} placeholder="Save path (optional)" />
          <button className="primary" disabled={!newCat.trim()} onClick={async () => {
            await run(() => client.createCategory(newCat.trim(), newCatPath.trim()))
            setNewCat(''); setNewCatPath('')
          }}>＋</button>
        </div>

        <h3>Tags</h3>
        <div className="chiprow">
          {tags.length === 0 && <span className="hint">No tags.</span>}
          {tags.map(t => (
            confirmDel === 'tag:' + t
              ? <button key={t} className="chip danger" onClick={async () => { await run(() => client.deleteTags(t)) }}>Delete "{t}"?</button>
              : <button key={t} className="chip" onClick={() => setConfirmDel('tag:' + t)}>{t} ✕</button>
          ))}
        </div>
        <div className="pwrow">
          <input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="New tag" />
          <button className="primary" disabled={!newTag.trim()} onClick={async () => {
            await run(() => client.createTags(newTag.trim())); setNewTag('')
          }}>＋</button>
        </div>

        <h3>Server</h3>
        <p className="hint">qBittorrent {version || '…'}</p>
      </>}

      {toast && <div className={'toast ' + (toast.ok ? 'ok' : 'error')}>{toast.text}</div>}

      <p className="hint">blackqbit · installable PWA — use your browser's "Add to Home Screen".</p>
    </div>
  )
}
