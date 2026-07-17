import React, { useCallback, useEffect, useState } from 'react'
import { useStore } from '../store.jsx'

// qBittorrent separates nested RSS paths with backslashes: "Folder\Sub\Feed"
const SEP = '\\'
const isFeed = node => node && typeof node === 'object' && 'uid' in node

function Tree({ node, path, depth, onSelect, selected, onAction }) {
  return Object.entries(node).map(([name, child]) => {
    const p = path ? path + SEP + name : name
    const feed = isFeed(child)
    return (
      <React.Fragment key={p}>
        <div
          className={'rssrow' + (selected === p ? ' sel' : '')}
          style={{ paddingLeft: 10 + depth * 18 }}
          onClick={() => feed ? onSelect(p, child) : null}>
          <span className="icon">{feed ? '📰' : '📁'}</span>
          <div className="tmain">
            <div className="tname">{name}</div>
            {feed && <div className="tmeta">
              <span>{(child.articles || []).length} articles</span>
              {child.hasError && <span className="err">error</span>}
              {child.isLoading && <span>refreshing…</span>}
            </div>}
          </div>
          <button onClick={e => { e.stopPropagation(); onAction(p, feed) }}>⋯</button>
        </div>
        {!feed && <Tree node={child} path={p} depth={depth + 1} onSelect={onSelect} selected={selected} onAction={onAction} />}
      </React.Fragment>
    )
  })
}

function RuleForm({ rule, name, feeds, onSave, onCancel }) {
  const { categories, tags } = useStore()
  const tp = rule.torrentParams || {}
  const draft = (() => {
    try {
      const d = JSON.parse(localStorage.getItem('rssRuleDraft'))
      return d && d.forName === (name || '') ? d.r : null
    } catch { return null }
  })()
  const [r, setR] = useState(draft || {
    name,
    enabled: rule.enabled ?? true,
    mustContain: rule.mustContain || '',
    mustNotContain: rule.mustNotContain || '',
    useRegex: rule.useRegex ?? false,
    episodeFilter: rule.episodeFilter || '',
    smartFilter: rule.smartFilter ?? false,
    affectedFeeds: rule.affectedFeeds || [],
    category: tp.category ?? rule.assignedCategory ?? '',
    save_path: tp.save_path ?? rule.savePath ?? '',
    tags: tp.tags || [],
    stopped: tp.stopped ?? rule.addPaused ?? false
  })
  const set = (k, v) => setR(prev => {
    const next = { ...prev, [k]: v }
    localStorage.setItem('rssRuleDraft', JSON.stringify({ forName: name || '', r: next }))
    return next
  })

  const submit = e => {
    e.preventDefault()
    onSave(r.name, {
      enabled: r.enabled,
      mustContain: r.mustContain,
      mustNotContain: r.mustNotContain,
      useRegex: r.useRegex,
      episodeFilter: r.episodeFilter,
      smartFilter: r.smartFilter,
      affectedFeeds: r.affectedFeeds,
      torrentParams: {
        category: r.category,
        save_path: r.save_path,
        tags: r.tags,
        stopped: r.stopped
      }
    })
  }

  return (
    <form className="form" onSubmit={submit}>
      <h3>{name ? `Edit rule: ${name}` : 'New rule'}</h3>
      {!name && <label>Rule name<input required value={r.name} onChange={e => set('name', e.target.value)} /></label>}
      <label className="row"><input type="checkbox" checked={r.enabled} onChange={e => set('enabled', e.target.checked)} /> Enabled</label>
      <label className="row"><input type="checkbox" checked={r.useRegex} onChange={e => set('useRegex', e.target.checked)} /> Use regex</label>
      <label>Must contain<input value={r.mustContain} onChange={e => set('mustContain', e.target.value)} placeholder="1080p" /></label>
      <label>Must not contain<input value={r.mustNotContain} onChange={e => set('mustNotContain', e.target.value)} /></label>
      <label>Episode filter<input value={r.episodeFilter} onChange={e => set('episodeFilter', e.target.value)} placeholder="1x01-;" /></label>
      <label className="row"><input type="checkbox" checked={r.smartFilter} onChange={e => set('smartFilter', e.target.checked)} /> Smart episode filter</label>
      <label>Apply to feeds
        <div className="feedpick">
          {feeds.map(f => (
            <label key={f.url} className="row">
              <input type="checkbox" checked={r.affectedFeeds.includes(f.url)}
                onChange={e => set('affectedFeeds', e.target.checked
                  ? [...r.affectedFeeds, f.url]
                  : r.affectedFeeds.filter(u => u !== f.url))} />
              {f.path}
            </label>
          ))}
          {feeds.length === 0 && <span className="hint">no feeds yet</span>}
        </div>
      </label>
      <label>Category
        <select value={r.category} onChange={e => set('category', e.target.value)}>
          <option value="">(none)</option>
          {Object.keys(categories).map(c => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label>Tags
        <div className="chiprow">
          {tags.length === 0 && <span className="hint">No tags exist — create some in Settings.</span>}
          {tags.map(t => (
            <button type="button" key={t} className={'chip' + (r.tags.includes(t) ? ' on' : '')}
              onClick={() => set('tags', r.tags.includes(t) ? r.tags.filter(x => x !== t) : [...r.tags, t])}>{t}</button>
          ))}
        </div>
      </label>
      <label>Save path<input value={r.save_path} onChange={e => set('save_path', e.target.value)} placeholder="default" /></label>
      <label className="row"><input type="checkbox" checked={r.stopped} onChange={e => set('stopped', e.target.checked)} /> Add stopped (paused)</label>
      <div className="chiprow">
        <button className="primary">Save rule</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

export default function Rss() {
  const { client, connected } = useStore()
  const [items, setItems] = useState({})
  const [rules, setRules] = useState({})
  const [view, setViewState] = useState(() => localStorage.getItem('rssView') === 'rules' ? 'rules' : 'feeds')
  const setView = v => { localStorage.setItem('rssView', v); setViewState(v) }
  const [selected, setSelected] = useState(null) // path of selected feed
  const [selectedFeed, setSelectedFeed] = useState(null)
  // {name, rule} — persisted so a refresh returns to the open rule editor
  const [editingRule, setEditingRuleState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rssEditingRule')) } catch { return null }
  })
  const setEditingRule = er => {
    if (er) localStorage.setItem('rssEditingRule', JSON.stringify(er))
    else { localStorage.removeItem('rssEditingRule'); localStorage.removeItem('rssRuleDraft') }
    setEditingRuleState(er)
  }
  const [toast, setToast] = useState(null)
  // sheet: {type:'item', path, feed} | {type:'addFeed'} | {type:'addFolder'} | null
  const [sheet, setSheet] = useState(null)
  const [field, setField] = useState({}) // scratch inputs for the open sheet
  const [rssLoaded, setRssLoaded] = useState(false)
  const [dlState, setDlState] = useState({}) // articleId -> 'ok' | 'fail'

  const notify = (ok, text) => { setToast({ ok, text }); setTimeout(() => setToast(null), 5000) }

  const refresh = useCallback(async () => {
    try {
      setItems(await client.rssItems(true))
      setRules(await client.rssRules())
      setRssLoaded(true)
    } catch (e) { notify(false, e.message) }
  }, [client])

  useEffect(() => { if (connected) refresh() }, [connected, refresh])
  useEffect(() => {
    if (!connected) return
    const iv = setInterval(refresh, 10000)
    return () => clearInterval(iv)
  }, [connected, refresh])

  if (!connected) return <div className="empty">Not connected.</div>
  if (!rssLoaded) return <div className="empty"><span className="spinner" /> Loading…</div>

  // flatten feeds (rule editor) and folders (folder pickers)
  const flatFeeds = []
  const folders = []
  const walk = (node, path) => Object.entries(node).forEach(([name, child]) => {
    const p = path ? path + SEP + name : name
    if (isFeed(child)) flatFeeds.push({ path: p, url: child.url })
    else { folders.push(p); walk(child, p) }
  })
  walk(items, '')

  const run = async (fn, okMsg) => {
    try { await fn(); await refresh(); if (okMsg) notify(true, okMsg) }
    catch (e) { notify(false, e.message) }
    setSheet(null)
  }

  const saveRule = async (name, def) => {
    try {
      await client.rssSetRule(name, def)
      setEditingRule(null); await refresh(); notify(true, 'Rule saved ✓')
    } catch (e) { notify(false, e.message) }
  }

  if (editingRule) return (
    <>
      <RuleForm name={editingRule.name} rule={editingRule.rule} feeds={flatFeeds}
        onSave={saveRule} onCancel={() => setEditingRule(null)} />
      {toast && <div className={'toast ' + (toast.ok ? 'ok' : 'error')}>{toast.text}</div>}
    </>
  )

  return (
    <div className="rss">
      <div className="chiprow tabs">
        <button className={'chip' + (view === 'feeds' ? ' on' : '')} onClick={() => setView('feeds')}>Feeds</button>
        <button className={'chip' + (view === 'rules' ? ' on' : '')} onClick={() => setView('rules')}>Rules</button>
      </div>

      {view === 'feeds' && <>
        <div className="chiprow actionsrow">
          <button className="chip on" onClick={() => { setField({ folder: '' }); setSheet({ type: 'addFeed' }) }}>＋ Feed</button>
          <button className="chip" onClick={() => { setField({ folder: '' }); setSheet({ type: 'addFolder' }) }}>＋ Folder</button>
          <button className="chip" onClick={async () => {
            await Promise.allSettled(flatFeeds.map(f => client.rssRefreshItem(f.path)))
            notify(true, 'Refreshing all feeds…')
          }}>↻ Refresh all</button>
        </div>

        <div className="list">
          {Object.keys(items).length === 0 && <div className="empty">No RSS items.</div>}
          <Tree node={items} path="" depth={0} selected={selected}
            onSelect={(p, feed) => { setSelected(p); setSelectedFeed(feed) }}
            onAction={(path, feed) => { setField({}); setSheet({ type: 'item', path, feed }) }} />
        </div>

        {selectedFeed && (
          <div className="articles">
            <h3>{selected.split(SEP).at(-1)}</h3>
            {(selectedFeed.articles || []).map(a => (
              <div key={a.id} className={'filerow' + (a.isRead ? ' read' : '')}>
                <div>
                  <div className="tname">{a.title}</div>
                  <div className="tmeta">
                    <span>{a.date && new Date(a.date).toLocaleString()}</span>
                    {a.author && <span>{a.author}</span>}
                  </div>
                </div>
                {(a.torrentURL || a.link) && (
                  <button className={dlState[a.id] === 'ok' ? 'ok' : dlState[a.id] === 'fail' ? 'danger' : ''}
                    onClick={async () => {
                      const fd = new FormData()
                      fd.append('urls', a.torrentURL || a.link)
                      try {
                        const r = await client.addTorrent(fd)
                        if (r === 'Fails.') throw new Error('qBittorrent rejected the torrent')
                        await client.rssMarkAsRead(selected, a.id)
                        setDlState(s => ({ ...s, [a.id]: 'ok' }))
                      } catch (e) {
                        setDlState(s => ({ ...s, [a.id]: 'fail' }))
                        notify(false, e.message)
                      }
                    }}>{dlState[a.id] === 'ok' ? '✓' : dlState[a.id] === 'fail' ? '✕' : '⬇'}</button>
                )}
              </div>
            ))}
            {(selectedFeed.articles || []).length === 0 && <div className="empty">No articles.</div>}
          </div>
        )}
      </>}

      {view === 'rules' && <>
        <div className="chiprow actionsrow">
          <button className="chip on" onClick={() => setEditingRule({ name: '', rule: {} })}>＋ New rule</button>
        </div>
        <div className="list">
          {Object.keys(rules).length === 0 && <div className="empty">No rules yet.</div>}
          {Object.entries(rules).map(([name, rule]) => (
            <div key={name} className="serverrow">
              <div onClick={() => setEditingRule({ name, rule })}>
                <div className="tname">{rule.enabled === false ? '⏸ ' : ''}{name}</div>
                <div className="tmeta">
                  {rule.mustContain && <span>contains: {rule.mustContain}</span>}
                  <span>{(rule.affectedFeeds || []).length} feed(s)</span>
                  {(rule.torrentParams?.category || rule.assignedCategory) && <span className="badge">{rule.torrentParams?.category || rule.assignedCategory}</span>}
                </div>
              </div>
              <button onClick={() => setEditingRule({ name, rule })}>Edit</button>
              <button className="danger" onClick={async () => {
                if (!confirm(`Delete rule "${name}"?`)) return
                try { await client.rssRemoveRule(name); await refresh() } catch (e) { notify(false, e.message) }
              }}>✕</button>
            </div>
          ))}
        </div>
      </>}

      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>

            {sheet.type === 'item' && <>
              <div className="sheet-head">
                <div className="tname">{sheet.feed ? '📰' : '📁'} {sheet.path.split(SEP).at(-1)}</div>
                <button onClick={() => setSheet(null)}>✕</button>
              </div>
              <div className="actionlist">
                {sheet.feed && <button onClick={() => run(() => client.rssRefreshItem(sheet.path), 'Refreshing…')}>↻ Refresh</button>}
                {sheet.feed && <button onClick={() => run(() => client.rssMarkAsRead(sheet.path), 'Marked read ✓')}>✓ Mark all read</button>}
                {field.renaming == null
                  ? <button onClick={() => setField({ renaming: sheet.path.split(SEP).at(-1) })}>✎ Rename</button>
                  : <div className="pwrow">
                      <input autoFocus value={field.renaming} onChange={e => setField({ renaming: e.target.value })} />
                      <button className="primary" disabled={!field.renaming.trim()} onClick={() => {
                        const parts = sheet.path.split(SEP)
                        run(() => client.rssMoveItem(sheet.path, [...parts.slice(0, -1), field.renaming.trim()].join(SEP)), 'Renamed ✓')
                      }}>OK</button>
                    </div>}
                {!field.confirmDelete
                  ? <button className="danger" onClick={() => setField({ confirmDelete: true })}>🗑 Delete</button>
                  : <button className="danger" onClick={() => run(() => client.rssRemoveItem(sheet.path), 'Deleted ✓')}>
                      Really delete "{sheet.path.split(SEP).at(-1)}"? Tap to confirm
                    </button>}
              </div>
            </>}

            {(sheet.type === 'addFeed' || sheet.type === 'addFolder') && <>
              <div className="sheet-head">
                <div className="tname">{sheet.type === 'addFeed' ? 'Add feed' : 'Add folder'}</div>
                <button onClick={() => setSheet(null)}>✕</button>
              </div>
              <div className="form">
                {sheet.type === 'addFeed' && <>
                  <label>Feed URL<input autoFocus value={field.url || ''} onChange={e => setField({ ...field, url: e.target.value })} placeholder="https://…/rss" /></label>
                  <label>Name (optional)<input value={field.name || ''} onChange={e => setField({ ...field, name: e.target.value })} /></label>
                </>}
                {sheet.type === 'addFolder' &&
                  <label>Folder name<input autoFocus value={field.name || ''} onChange={e => setField({ ...field, name: e.target.value })} /></label>}
                <label>Location
                  <div className="chiprow">
                    <button className={'chip' + (field.folder === '' ? ' on' : '')} onClick={() => setField({ ...field, folder: '' })}>root</button>
                    {folders.map(f => (
                      <button key={f} className={'chip' + (field.folder === f ? ' on' : '')} onClick={() => setField({ ...field, folder: f })}>{f.replaceAll(SEP, ' / ')}</button>
                    ))}
                  </div>
                </label>
                <button className="primary"
                  disabled={sheet.type === 'addFeed' ? !(field.url || '').trim() : !(field.name || '').trim()}
                  onClick={() => {
                    const inFolder = n => field.folder ? field.folder + SEP + n : n
                    if (sheet.type === 'addFeed') {
                      const url = field.url.trim()
                      run(() => client.rssAddFeed(url, inFolder((field.name || '').trim() || url)), 'Feed added ✓')
                    } else {
                      run(() => client.rssAddFolder(inFolder(field.name.trim())), 'Folder added ✓')
                    }
                  }}>Add</button>
              </div>
            </>}

          </div>
        </div>
      )}

      {toast && <div className={'toast ' + (toast.ok ? 'ok' : 'error')}>{toast.text}</div>}
    </div>
  )
}
