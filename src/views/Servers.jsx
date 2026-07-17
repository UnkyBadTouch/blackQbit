import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import Prefs from './Prefs.jsx'

const blank = { name: '', url: '', username: '', password: '' }

export default function Servers() {
  const { servers, setServers, activeId, setActiveId, connected, connError, active } = useStore()
  const [editing, setEditing] = useState(null) // null | {id?, ...fields}
  const [showPw, setShowPw] = useState(false)
  const [toast, setToast] = useState(null) // {ok, text}
  const [testing, setTesting] = useState(false)

  const testConnection = async () => {
    setTesting(true)
    setToast(null)
    const { QbitClient } = await import('../api/qbit.js')
    const c = new QbitClient(editing.url, { insecure: editing.insecure })
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Connection timed out (10s)')), 10000))
    try {
      const r = await Promise.race([
        editing.username ? c.login(editing.username, editing.password) : c.version(),
        timeout
      ])
      if (r === 'Fails.') throw new Error('Server reached, but login failed — check credentials')
      setToast({ ok: true, text: 'Connection OK ✓' })
    } catch (e) {
      setToast({ ok: false, text: e.message === 'Failed to fetch' ? 'Unreachable — network/CORS blocked' : e.message })
    } finally {
      setTesting(false)
      setTimeout(() => setToast(null), 6000)
    }
  }

  const saveServer = e => {
    e.preventDefault()
    if (editing.id) {
      setServers(servers.map(s => s.id === editing.id ? editing : s))
    } else {
      const s = { ...editing, id: Date.now().toString(36) + Math.random().toString(36).slice(2) }
      setServers([...servers, s])
      setActiveId(s.id)
    }
    setEditing(null)
  }

  const remove = id => {
    if (!confirm('Remove this server?')) return
    setServers(servers.filter(s => s.id !== id))
    if (activeId === id) setActiveId(null)
  }

  if (editing) return (
    <form className="form" onSubmit={saveServer}>
      <h2>{editing.id ? 'Edit server' : 'Add server'}</h2>
      <label>Name<input required value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Home NAS" /></label>
      <label>URL<input required type="url" value={editing.url} onChange={e => setEditing({ ...editing, url: e.target.value })} placeholder="http://192.168.1.10:8080" /></label>
      <label>Username<input value={editing.username} onChange={e => setEditing({ ...editing, username: e.target.value })} placeholder="blank if auth bypassed" /></label>
      <label>Password
        <div className="pwrow">
          <input type={showPw ? 'text' : 'password'} value={editing.password} onChange={e => setEditing({ ...editing, password: e.target.value })} />
          <button type="button" onClick={() => setShowPw(v => !v)}>{showPw ? 'Hide' : 'Show'}</button>
        </div>
      </label>
      <label className="row">
        <input type="checkbox" checked={!!editing.insecure} onChange={e => setEditing({ ...editing, insecure: e.target.checked })} />
        Ignore invalid SSL certificate (self-signed / IP mismatch)
      </label>
      <div className="chiprow">
        <button className="primary">Save</button>
        <button type="button" disabled={testing || !editing.url} onClick={testConnection}>
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        <button type="button" onClick={() => setEditing(null)}>Cancel</button>
      </div>
      <p className="hint">Note: for a hosted PWA the server must allow cross-origin requests, or serve this app from the same host / reverse proxy as qBittorrent.</p>
      {toast && <div className={'toast ' + (toast.ok ? 'ok' : 'error')}>{toast.text}</div>}
    </form>
  )

  return (
    <div className="form">
      <h2>Servers</h2>
      {servers.length === 0 && <div className="empty">No servers yet — add one to get started.</div>}
      {servers.map(s => (
        <div key={s.id} className={'serverrow' + (s.id === activeId ? ' sel' : '')}>
          <div onClick={() => setActiveId(s.id)}>
            <div className="tname">{s.name} {s.id === activeId && (connected ? '· connected' : connError ? '· error' : '· connecting…')}</div>
            <div className="tmeta"><span className="mono">{s.url}</span></div>
          </div>
          <button onClick={() => setEditing({ ...s })}>Edit</button>
          <button className="danger" onClick={() => remove(s.id)}>✕</button>
        </div>
      ))}
      <button className="primary" onClick={() => setEditing({ ...blank })}>＋ Add server</button>

      {connected && <>
        <h3>{active?.name} preferences</h3>
        <Prefs notify={(ok, text) => { setToast({ ok, text }); setTimeout(() => setToast(null), 5000) }} />
      </>}

      {toast && <div className={'toast ' + (toast.ok ? 'ok' : 'error')}>{toast.text}</div>}
    </div>
  )
}
