import React, { useEffect, useRef, useState } from 'react'
import { useStore, fmtBytes } from '../store.jsx'

const CATEGORIES = ['all', 'anime', 'books', 'games', 'movies', 'music', 'software', 'tv']

export default function Search() {
  const { client, connected } = useStore()
  const [view, setView] = useState('search') // search | plugins
  const [plugins, setPlugins] = useState([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [usePlugins, setUsePlugins] = useState('enabled') // 'enabled' | specific name
  const [searchId, setSearchId] = useState(null)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState([])
  const [dlState, setDlState] = useState({}) // fileUrl -> 'ok' | 'fail'
  const [toast, setToast] = useState(null)
  const [pluginsLoaded, setPluginsLoaded] = useState(false)
  const [installUrl, setInstallUrl] = useState('')
  const pollRef = useRef(null)

  const notify = (ok, text) => { setToast({ ok, text }); setTimeout(() => setToast(null), 5000) }

  const loadPlugins = async () => {
    try { setPlugins(await client.searchPlugins()); setPluginsLoaded(true) }
    catch (e) { notify(false, e.message) }
  }
  useEffect(() => { if (connected) loadPlugins() }, [connected])
  useEffect(() => () => clearInterval(pollRef.current), [])

  if (!connected && !pluginsLoaded) return <div className="empty">Not connected.</div>
  if (!pluginsLoaded) return <div className="empty"><span className="spinner" /> Loading…</div>

  const startSearch = async e => {
    e.preventDefault()
    clearInterval(pollRef.current)
    setResults([]); setDlState({})
    try {
      const { id } = await client.searchStart(query.trim(), usePlugins, category)
      setSearchId(id); setRunning(true)
      pollRef.current = setInterval(async () => {
        try {
          const [st] = await client.searchStatus(id)
          const r = await client.searchResults(id, 500)
          setResults(r.results || [])
          if (st?.status === 'Stopped') { setRunning(false); clearInterval(pollRef.current) }
        } catch { setRunning(false); clearInterval(pollRef.current) }
      }, 2000)
    } catch (e2) { notify(false, e2.message) }
  }

  const stopSearch = async () => {
    clearInterval(pollRef.current)
    setRunning(false)
    if (searchId != null) try { await client.searchStop(searchId) } catch {}
  }

  const download = async r => {
    const fd = new FormData()
    fd.append('urls', r.fileUrl)
    try {
      const res = await client.addTorrent(fd)
      if (res === 'Fails.') throw new Error('qBittorrent rejected the torrent')
      setDlState(s => ({ ...s, [r.fileUrl]: 'ok' }))
    } catch (e) {
      setDlState(s => ({ ...s, [r.fileUrl]: 'fail' }))
      notify(false, e.message)
    }
  }

  const enabledCount = plugins.filter(p => p.enabled).length

  return (
    <div className="search">
      {!connected && <div className="banner error">Reconnecting…</div>}
      <div className="chiprow tabs">
        <button className={'chip' + (view === 'search' ? ' on' : '')} onClick={() => setView('search')}>Search</button>
        <button className={'chip' + (view === 'plugins' ? ' on' : '')} onClick={() => setView('plugins')}>Plugins ({enabledCount}/{plugins.length})</button>
      </div>

      {view === 'search' && <>
        {plugins.length === 0 && <div className="banner error">No search plugins installed — add some in the Plugins tab.</div>}
        <form className="form" onSubmit={startSearch}>
          <div className="toolbar">
            <input placeholder="Search…" value={query} onChange={e => setQuery(e.target.value)} />
            {running
              ? <button type="button" className="danger" onClick={stopSearch}>Stop</button>
              : <button className="primary" disabled={!query.trim() || !enabledCount}>Go</button>}
          </div>
          <div className="chiprow">
            {CATEGORIES.map(c => (
              <button type="button" key={c} className={'chip' + (category === c ? ' on' : '')} onClick={() => setCategory(c)}>{c}</button>
            ))}
          </div>
          <div className="chiprow">
            <button type="button" className={'chip' + (usePlugins === 'enabled' ? ' on' : '')} onClick={() => setUsePlugins('enabled')}>all enabled plugins</button>
            {plugins.filter(p => p.enabled).map(p => (
              <button type="button" key={p.name} className={'chip' + (usePlugins === p.name ? ' on' : '')} onClick={() => setUsePlugins(p.name)}>{p.fullName || p.name}</button>
            ))}
          </div>
        </form>

        <div className="list actionsrow">
          {running && <div className="empty"><span className="spinner" /> Searching… {results.length} results</div>}
          {!running && searchId != null && results.length === 0 && <div className="empty">No results.</div>}
          {!running && searchId != null && results.length > 0 && <div className="hint">{results.length} result{results.length === 1 ? '' : 's'}</div>}
          {[...results].sort((a, b) => (b.nbSeeders || 0) - (a.nbSeeders || 0)).map(r => (
            <div key={r.fileUrl} className="filerow">
              <div>
                <div className="tname">{r.fileName}</div>
                <div className="tmeta">
                  <span>{fmtBytes(r.fileSize)}</span>
                  <span>🌱 {r.nbSeeders}</span>
                  <span>🧲 {r.nbLeechers}</span>
                  <span className="badge">{r.siteUrl && new URL(r.siteUrl).hostname}</span>
                </div>
              </div>
              <button className={dlState[r.fileUrl] === 'ok' ? 'ok' : dlState[r.fileUrl] === 'fail' ? 'danger' : ''}
                onClick={() => download(r)}>
                {dlState[r.fileUrl] === 'ok' ? '✓' : dlState[r.fileUrl] === 'fail' ? '✕' : '⬇'}
              </button>
            </div>
          ))}
        </div>
      </>}

      {view === 'plugins' && <>
        <div className="form actionsrow">
          <div className="pwrow">
            <input placeholder="Plugin source URL (.py)" value={installUrl} onChange={e => setInstallUrl(e.target.value)} />
            <button className="primary" disabled={!installUrl.trim()} onClick={async () => {
              try {
                await client.searchInstallPlugin(installUrl.trim())
                setInstallUrl(''); notify(true, 'Installing…'); setTimeout(loadPlugins, 2000)
              } catch (e) { notify(false, e.message) }
            }}>Install</button>
          </div>
        </div>
        <div className="chiprow actionsrow">
          <button className="chip" onClick={async () => {
            try { await client.searchUpdatePlugins(); notify(true, 'Updating plugins…'); setTimeout(loadPlugins, 3000) }
            catch (e) { notify(false, e.message) }
          }}>↻ Update all</button>
        </div>
        <div className="list">
          {plugins.length === 0 && <div className="empty">No plugins installed.</div>}
          {plugins.map(p => (
            <div key={p.name} className="serverrow">
              <div>
                <div className="tname">{p.fullName || p.name} <span className="hint">v{p.version}</span></div>
                <div className="tmeta"><span className="mono">{p.url}</span></div>
              </div>
              <button className={p.enabled ? 'ok' : ''} onClick={async () => {
                await client.searchEnablePlugin(p.name, !p.enabled); loadPlugins()
              }}>{p.enabled ? 'Enabled' : 'Disabled'}</button>
              <button className="danger" onClick={async () => {
                if (!confirm(`Uninstall "${p.fullName || p.name}"?`)) return
                await client.searchUninstallPlugin(p.name); loadPlugins()
              }}>✕</button>
            </div>
          ))}
        </div>
      </>}

      {toast && <div className={'toast ' + (toast.ok ? 'ok' : 'error')}>{toast.text}</div>}
    </div>
  )
}
