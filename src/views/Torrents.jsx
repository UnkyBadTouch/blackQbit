import React, { useEffect, useMemo, useState } from 'react'
import { useStore, fmtBytes, fmtSpeed, fmtEta } from '../store.jsx'
import TorrentDetail from './TorrentDetail.jsx'

const STATUS_FILTERS = ['all', 'downloading', 'seeding', 'completed', 'paused', 'active', 'inactive', 'stalled', 'errored']

const stateLabel = s => ({
  downloading: 'Downloading', metaDL: 'Metadata', forcedDL: 'Forced DL',
  uploading: 'Seeding', forcedUP: 'Forced seed', stalledDL: 'Stalled', stalledUP: 'Seeding',
  pausedDL: 'Paused', pausedUP: 'Done', stoppedDL: 'Stopped', stoppedUP: 'Done',
  queuedDL: 'Queued', queuedUP: 'Queued', checkingDL: 'Checking', checkingUP: 'Checking',
  checkingResumeData: 'Checking', error: 'Error', missingFiles: 'Missing files', moving: 'Moving'
}[s] || s)

const matchesStatus = (t, f) => {
  const s = t.state
  switch (f) {
    case 'all': return true
    case 'downloading': return ['downloading', 'metaDL', 'forcedDL', 'stalledDL', 'queuedDL', 'checkingDL'].includes(s)
    case 'seeding': return ['uploading', 'forcedUP', 'stalledUP', 'queuedUP', 'checkingUP'].includes(s)
    case 'completed': return t.progress >= 1
    case 'paused': return ['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP'].includes(s)
    case 'active': return t.dlspeed > 0 || t.upspeed > 0
    case 'inactive': return !t.dlspeed && !t.upspeed
    case 'stalled': return ['stalledDL', 'stalledUP'].includes(s)
    case 'errored': return ['error', 'missingFiles'].includes(s)
    default: return true
  }
}

const SORTS = [
  ['name', 'Name'], ['added_on', 'Added'], ['size', 'Size'], ['progress', 'Progress'],
  ['dlspeed', 'DL speed'], ['upspeed', 'UP speed'], ['eta', 'ETA'], ['ratio', 'Ratio'],
  ['num_complete', 'Seeds'], ['completion_on', 'Completed']
]

const loadPrefs = () => {
  try { return JSON.parse(localStorage.getItem('torrentPrefs')) || {} } catch { return {} }
}

export default function Torrents() {
  const { torrents, categories, tags, client, connected, loaded } = useStore()
  const prefs = useMemo(loadPrefs, [])
  const [status, setStatus] = useState(prefs.status ?? 'all')
  const [category, setCategory] = useState(prefs.category ?? null) // null=any, ''=uncategorized
  const [tag, setTag] = useState(prefs.tag ?? null)                // null=any, ''=untagged
  const [sort, setSort] = useState(prefs.sort ?? 'name')
  const [desc, setDesc] = useState(prefs.desc ?? false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    localStorage.setItem('torrentPrefs', JSON.stringify({ status, category, tag, sort, desc }))
  }, [status, category, tag, sort, desc])
  const [selected, setSelected] = useState(new Set())
  const [detail, setDetail] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [bulkPicker, setBulkPicker] = useState(null) // 'category' | 'tags' | null
  const [tagMode, setTagMode] = useState('add')      // 'add' | 'remove'

  const list = useMemo(() => {
    return Object.entries(torrents)
      .map(([hash, t]) => ({ hash, ...t }))
      .filter(t => matchesStatus(t, status))
      .filter(t => category === null || (t.category || '') === category)
      .filter(t => {
        if (tag === null) return true
        const tt = (t.tags || '').split(',').map(x => x.trim()).filter(Boolean)
        return tag === '' ? tt.length === 0 : tt.includes(tag)
      })
      .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const va = a[sort], vb = b[sort]
        const r = typeof va === 'string' ? va.localeCompare(vb) : (va ?? 0) - (vb ?? 0)
        return desc ? -r : r
      })
  }, [torrents, status, category, tag, search, sort, desc])

  const toggle = hash => setSelected(prev => {
    const s = new Set(prev)
    s.has(hash) ? s.delete(hash) : s.add(hash)
    return s
  })
  const selHashes = () => [...selected].join('|')
  const act = async fn => { await fn(); setSelected(new Set()) }

  if (!connected) return <div className="empty">Not connected.</div>
  if (!loaded) return <div className="empty"><span className="spinner" /> Loading…</div>

  return (
    <div className="torrents">
      <div className="toolbar">
        <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className={showFilters ? 'primary' : ''} onClick={() => setShowFilters(v => !v)}>Filter</button>
      </div>

      {showFilters && (
        <div className="filters">
          <div className="chiprow">
            {STATUS_FILTERS.map(f => (
              <button key={f} className={'chip' + (status === f ? ' on' : '')} onClick={() => setStatus(f)}>{f}</button>
            ))}
          </div>
          <div className="chiprow">
            <button className={'chip' + (category === null ? ' on' : '')} onClick={() => setCategory(null)}>any category</button>
            <button className={'chip' + (category === '' ? ' on' : '')} onClick={() => setCategory('')}>uncategorized</button>
            {Object.keys(categories).map(c => (
              <button key={c} className={'chip' + (category === c ? ' on' : '')} onClick={() => setCategory(c)}>{c}</button>
            ))}
          </div>
          <div className="chiprow">
            <button className={'chip' + (tag === null ? ' on' : '')} onClick={() => setTag(null)}>any tag</button>
            <button className={'chip' + (tag === '' ? ' on' : '')} onClick={() => setTag('')}>untagged</button>
            {tags.map(t => (
              <button key={t} className={'chip' + (tag === t ? ' on' : '')} onClick={() => setTag(t)}>{t}</button>
            ))}
          </div>
          <div className="chiprow">
            <button className="chip" onClick={() => setDesc(d => !d)}>{desc ? '↓ desc' : '↑ asc'}</button>
            {SORTS.map(([key, label]) => (
              <button key={key} className={'chip' + (sort === key ? ' on' : '')} onClick={() => setSort(key)}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="selbar">
          <span>{selected.size} selected</span>
          <button onClick={() => act(() => client.start(selHashes()))}>Resume</button>
          <button onClick={() => act(() => client.stop(selHashes()))}>Pause</button>
          <button onClick={() => act(() => client.recheck(selHashes()))}>Recheck</button>
          <button className={bulkPicker === 'category' ? 'primary' : ''} onClick={() => setBulkPicker(p => p === 'category' ? null : 'category')}>Category</button>
          <button className={bulkPicker === 'tags' ? 'primary' : ''} onClick={() => setBulkPicker(p => p === 'tags' ? null : 'tags')}>Tags</button>
          <button className="danger" onClick={() => {
            const files = confirm('Also delete downloaded files?\nOK = delete files, Cancel = keep files')
            act(() => client.delete(selHashes(), files))
          }}>Delete</button>
          <button onClick={() => setSelected(new Set())}>✕</button>

          {bulkPicker === 'category' && (
            <div className="picker">
              <div className="hint">Set category on {selected.size} torrent(s)</div>
              <div className="chiprow">
                <button className="chip" onClick={() => { client.setCategory(selHashes(), ''); setBulkPicker(null) }}>(none)</button>
                {Object.keys(categories).map(c => (
                  <button key={c} className="chip" onClick={() => { client.setCategory(selHashes(), c); setBulkPicker(null) }}>{c}</button>
                ))}
              </div>
            </div>
          )}

          {bulkPicker === 'tags' && (
            <div className="picker">
              <div className="chiprow">
                <span className="hint">Tap a tag to</span>
                <button className={'chip' + (tagMode === 'add' ? ' on' : '')} onClick={() => setTagMode('add')}>add</button>
                <button className={'chip' + (tagMode === 'remove' ? ' on' : '')} onClick={() => setTagMode('remove')}>remove</button>
              </div>
              <div className="chiprow">
                {tags.length === 0 && <span className="hint">No tags exist — create some in Settings.</span>}
                {tags.map(t => (
                  <button key={t} className="chip" onClick={() =>
                    tagMode === 'add' ? client.addTags(selHashes(), t) : client.removeTags(selHashes(), t)
                  }>{t}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="list">
        {list.length === 0 && <div className="empty">{Object.keys(torrents).length === 0 ? 'No torrents.' : 'No torrents match the filters.'}</div>}
        {list.map(t => (
          <div key={t.hash} className={'torrent' + (selected.has(t.hash) ? ' sel' : '')}
            onClick={() => selected.size ? toggle(t.hash) : setDetail(t.hash)}
            onContextMenu={e => { e.preventDefault(); toggle(t.hash) }}>
            <input type="checkbox" checked={selected.has(t.hash)}
              onClick={e => e.stopPropagation()} onChange={() => toggle(t.hash)} />
            <div className="tmain">
              <div className="tname">{t.name}</div>
              <div className="progress"><div style={{ width: `${t.progress * 100}%` }} /></div>
              <div className="tmeta">
                <span className={'state s-' + t.state}>{stateLabel(t.state)}</span>
                <span>{(t.progress * 100).toFixed(1)}%</span>
                <span>{fmtBytes(t.size)}</span>
                {t.dlspeed > 0 && <span>↓ {fmtSpeed(t.dlspeed)}</span>}
                {t.upspeed > 0 && <span>↑ {fmtSpeed(t.upspeed)}</span>}
                {t.progress < 1 && <span>ETA {fmtEta(t.eta)}</span>}
                {t.category && <span className="badge">{t.category}</span>}
                {(t.tags || '').split(',').filter(x => x.trim()).map(x => <span key={x} className="badge tag">{x.trim()}</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {detail && <TorrentDetail hash={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
