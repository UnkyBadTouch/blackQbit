import React, { useEffect, useState } from 'react'
import { useStore } from '../store.jsx'
import CatTags from './CatTags.jsx'
import Prefs from './Prefs.jsx'

const blank = { name: '', url: '', username: '', password: '' }

// qBittorrent's global cookie jar (/app/cookies) — used when fetching .torrent files
// and RSS feeds from sites that need a login cookie.
// www.blah.com, blah.com and .blah.com all belong to the same site.
const baseDomain = d => (d || '').replace(/^\.+/, '').replace(/^www\./, '')

function CookieManager({ client, notify }) {
  const [cookies, setCookies] = useState(null)
  const [draft, setDraft] = useState(null) // {domain,path,name,value}
  const [editIndex, setEditIndex] = useState(null) // index being edited, or null when adding
  const [openDomain, setOpenDomain] = useState(null)

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

  const submit = e => {
    e.preventDefault()
    const year = Math.floor(Date.now() / 1000) + 31536000
    const entry = { ...draft, path: draft.path || '/', expirationDate: year }
    save(editIndex === null ? [...cookies, entry] : cookies.map((c, i) => i === editIndex ? entry : c))
    setDraft(null); setEditIndex(null)
  }

  const groups = {}
  cookies?.forEach((c, i) => {
    const key = baseDomain(c.domain)
    ;(groups[key] ||= []).push({ c, i })
  })

  const draftForm = label => (
    <form onSubmit={submit} className="picker">
      <label>Domain<input required placeholder="tracker.example.org" value={draft.domain} onChange={e => setDraft({ ...draft, domain: e.target.value })} /></label>
      <label>Path<input placeholder="/" value={draft.path} onChange={e => setDraft({ ...draft, path: e.target.value })} /></label>
      <label>Name<input required placeholder="session_id" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <label>Value<input required value={draft.value} onChange={e => setDraft({ ...draft, value: e.target.value })} /></label>
      <div className="chiprow">
        <button className="chip on" type="submit">{label}</button>
        <button className="chip" type="button" onClick={() => { setDraft(null); setEditIndex(null) }}>Cancel</button>
      </div>
    </form>
  )

  return (
    <>
      <p className="hint">Sent by qBittorrent when it downloads .torrent files or RSS feeds from these domains.</p>
      {cookies === null && <p className="hint">Loading…</p>}
      {Object.entries(groups).map(([domain, list]) => (
        <div key={domain}>
          <div className="serverrow">
            <div onClick={() => setOpenDomain(openDomain === domain ? null : domain)}>
              <div className="tname">{openDomain === domain ? '▾' : '▸'} {domain} <span className="hint">({list.length})</span></div>
            </div>
          </div>
          {openDomain === domain && list.map(({ c, i }) => (
            <React.Fragment key={i}>
              <div className="serverrow">
                <div>
                  <div>{c.name} <span className="hint">@ {c.domain}{c.path}</span></div>
                  <div className="mono">{c.value.length > 40 ? c.value.slice(0, 40) + '…' : c.value}</div>
                </div>
                <button className="chip" onClick={() => { setDraft({ ...c }); setEditIndex(i) }}>Edit</button>
                <button className="chip danger" onClick={() => save(cookies.filter((_, j) => j !== i))}>Delete</button>
              </div>
              {draft && editIndex === i && draftForm('Save cookie')}
            </React.Fragment>
          ))}
        </div>
      ))}
      {cookies?.length === 0 && <p className="hint">No cookies stored.</p>}
      {draft && editIndex === null && draftForm('Add cookie')}
      {!draft && (
        <div className="chiprow">
          <button className="chip" onClick={() => setDraft({ domain: '', path: '/', name: '', value: '' })}>＋ Add cookie</button>
        </div>
      )}
    </>
  )
}

export default function Servers() {
  const { servers, setServers, activeId, setActiveId, connected, connError, client } = useStore()
  const [editing, setEditing] = useState(null) // null | {id?, ...fields}
  const [showPw, setShowPw] = useState(false)
  const [toast, setToast] = useState(null) // {ok, text}
  const [testing, setTesting] = useState(false)
  const [section, setSection] = useState(null) // 'cattags' | 'prefs' | 'cookies' | null

  const notify = (ok, text) => { setToast({ ok, text }); setTimeout(() => setToast(null), 5000) }
  const server = servers[0] || null

  const testConnection = async () => {
    setTesting(true)
    setToast(null)
    const { QbitClient } = await import('../api/qbit.js')
    const c = new QbitClient(editing.url, { timeout: editing.timeout })
    try {
      const r = await (editing.username ? c.login(editing.username, editing.password) : c.version())
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
      setServers([editing])
    } else {
      const s = { ...editing, id: Date.now().toString(36) + Math.random().toString(36).slice(2) }
      setServers([s])
      setActiveId(s.id)
    }
    setEditing(null)
  }

  const remove = () => {
    if (!confirm('Remove this server?')) return
    setServers([])
    setActiveId(null)
  }

  if (editing) return (
    <form className="form" onSubmit={saveServer}>
      <h2>{editing.id ? 'Edit server' : 'Add server'}</h2>
      <label>Name<input required value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Home NAS" /></label>
      <label>URL<input required type="url" value={editing.url} onChange={e => setEditing({ ...editing, url: e.target.value })} placeholder="http://192.168.1.10:8080" /></label>
      <label>Username<input value={editing.username} onChange={e => setEditing({ ...editing, username: e.target.value })} placeholder="blank if auth bypassed" /></label>
      <label>Request timeout (seconds)<input type="number" min="5" max="300" value={editing.timeout ?? 5} onChange={e => setEditing({ ...editing, timeout: Number(e.target.value) })} /></label>
      <label>Password
        <div className="pwrow">
          <input type={showPw ? 'text' : 'password'} value={editing.password} onChange={e => setEditing({ ...editing, password: e.target.value })} />
          <button type="button" onClick={() => setShowPw(v => !v)}>{showPw ? 'Hide' : 'Show'}</button>
        </div>
      </label>
      <div className="chiprow">
        <button className="primary">Save</button>
        <button type="button" disabled={testing || !editing.url} onClick={testConnection}>
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        <button type="button" onClick={() => setEditing(null)}>Cancel</button>
      </div>
      {toast && <div className={'toast ' + (toast.ok ? 'ok' : 'error')}>{toast.text}</div>}
    </form>
  )

  return (
    <div className="form">
      <h2>Server</h2>
      {!server && <div className="empty">No server yet — add one to get started.</div>}
      {server && (
        <div className={'serverrow' + (server.id === activeId ? ' sel' : '')}>
          <div onClick={() => setActiveId(server.id)}>
            <div className="tname">{server.name} {server.id === activeId && (connected ? '· connected' : connError ? '· error' : '· connecting…')}</div>
            <div className="tmeta"><span className="mono">{server.url}</span></div>
          </div>
          <button onClick={() => setEditing({ ...server })}>Edit</button>
          <button className="danger" onClick={remove}>✕</button>
        </div>
      )}
      {!server && <button className="primary" onClick={() => setEditing({ ...blank })}>＋ Add server</button>}

      {server && connected && <>
        <div className="chiprow">
          <button className={'chip' + (section === 'cattags' ? ' on' : '')} onClick={() => setSection(section === 'cattags' ? null : 'cattags')}>Categories & tags</button>
          <button className={'chip' + (section === 'prefs' ? ' on' : '')} onClick={() => setSection(section === 'prefs' ? null : 'prefs')}>Preferences</button>
          <button className={'chip' + (section === 'cookies' ? ' on' : '')} onClick={() => setSection(section === 'cookies' ? null : 'cookies')}>Cookies</button>
        </div>
        {section === 'cattags' && <CatTags notify={notify} />}
        {section === 'prefs' && <Prefs notify={notify} />}
        {section === 'cookies' && <CookieManager client={client} notify={notify} />}
      </>}

      {toast && <div className={'toast ' + (toast.ok ? 'ok' : 'error')}>{toast.text}</div>}
    </div>
  )
}
