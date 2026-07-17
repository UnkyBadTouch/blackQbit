import React, { useEffect, useState } from 'react'
import { useStore, fmtBytes, fmtSpeed } from '../store.jsx'

const DTABS = ['General', 'Files', 'Trackers', 'Peers']

export default function TorrentDetail({ hash, onClose }) {
  const { client, torrents, categories, tags } = useStore()
  const t = torrents[hash]
  const [dtab, setDtab] = useState('General')
  const [props, setProps] = useState(null)
  const [files, setFiles] = useState([])
  const [trackers, setTrackers] = useState([])
  const [peers, setPeers] = useState({})

  useEffect(() => {
    let stop = false
    const loadTab = async () => {
      try {
        if (dtab === 'General') setProps(await client.torrentProperties(hash))
        if (dtab === 'Files') setFiles(await client.torrentFiles(hash))
        if (dtab === 'Trackers') setTrackers(await client.torrentTrackers(hash))
        if (dtab === 'Peers') {
          const d = await client.syncTorrentPeers(hash)
          if (!stop) setPeers(d.peers || {})
        }
      } catch { /* torrent may be gone */ }
    }
    loadTab()
    const iv = setInterval(loadTab, 3000)
    return () => { stop = true; clearInterval(iv) }
  }, [dtab, hash, client])

  if (!t) return null
  const h = hash

  const [picker, setPicker] = useState(null) // 'category' | 'tags' | null
  const curTags = (t.tags || '').split(',').map(x => x.trim()).filter(Boolean)

  const toggleTag = async tag => {
    if (curTags.includes(tag)) await client.removeTags(h, tag)
    else await client.addTags(h, tag)
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="tname">{t.name}</div>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="chiprow">
          <button className="chip" onClick={() => client.start(h)}>Resume</button>
          <button className="chip" onClick={() => client.stop(h)}>Pause</button>
          <button className="chip" onClick={() => client.setForceStart(h, true)}>Force start</button>
          <button className="chip" onClick={() => client.recheck(h)}>Recheck</button>
          <button className="chip" onClick={() => client.reannounce(h)}>Reannounce</button>
          <button className="chip" onClick={() => setPicker(picker === 'category' ? null : 'category')}>Category</button>
          <button className="chip" onClick={() => setPicker(picker === 'tags' ? null : 'tags')}>Tags</button>
          <button className="chip" onClick={async () => {
            const loc = prompt('New save path:', t.save_path)
            if (loc) await client.setLocation(h, loc)
          }}>Move</button>
          <button className="chip" onClick={async () => {
            const n = prompt('Rename torrent:', t.name)
            if (n) await client.rename(h, n)
          }}>Rename</button>
          <button className="chip danger" onClick={async () => {
            const files = confirm('Also delete files? OK = yes, Cancel = keep')
            await client.delete(h, files); onClose()
          }}>Delete</button>
        </div>

        {picker === 'category' && (
          <div className="picker">
            <div className="hint">Set category</div>
            <div className="chiprow">
              <button className={'chip' + (!t.category ? ' on' : '')}
                onClick={() => { client.setCategory(h, ''); setPicker(null) }}>(none)</button>
              {Object.keys(categories).map(c => (
                <button key={c} className={'chip' + (t.category === c ? ' on' : '')}
                  onClick={() => { client.setCategory(h, c); setPicker(null) }}>{c}</button>
              ))}
            </div>
          </div>
        )}

        {picker === 'tags' && (
          <div className="picker">
            <div className="hint">Toggle tags</div>
            <div className="chiprow">
              {tags.length === 0 && <span className="hint">No tags exist — create some in Settings.</span>}
              {tags.map(tag => (
                <button key={tag} className={'chip' + (curTags.includes(tag) ? ' on' : '')}
                  onClick={() => toggleTag(tag)}>{tag}</button>
              ))}
            </div>
          </div>
        )}

        <div className="chiprow tabs">
          {DTABS.map(d => <button key={d} className={'chip' + (dtab === d ? ' on' : '')} onClick={() => setDtab(d)}>{d}</button>)}
        </div>

        <div className="sheet-body">
          {dtab === 'General' && props && (
            <div className="kv">
              <div><b>Save path</b><span>{props.save_path}</span></div>
              <div><b>Size</b><span>{fmtBytes(props.total_size)} ({fmtBytes(props.total_downloaded)} down / {fmtBytes(props.total_uploaded)} up)</span></div>
              <div><b>Ratio</b><span>{props.share_ratio?.toFixed(2)}</span></div>
              <div><b>Speed</b><span>↓ {fmtSpeed(props.dl_speed)} · ↑ {fmtSpeed(props.up_speed)}</span></div>
              <div><b>Seeds / Peers</b><span>{props.seeds} ({props.seeds_total}) / {props.peers} ({props.peers_total})</span></div>
              <div><b>Pieces</b><span>{props.pieces_have} / {props.pieces_num} × {fmtBytes(props.piece_size)}</span></div>
              <div><b>Added</b><span>{new Date(props.addition_date * 1000).toLocaleString()}</span></div>
              <div><b>Hash</b><span className="mono">{hash}</span></div>
              {props.comment && <div><b>Comment</b><span>{props.comment}</span></div>}
            </div>
          )}

          {dtab === 'Files' && files.map(f => (
            <div key={f.index ?? f.name} className="filerow">
              <select value={f.priority} onChange={e => client.setFilePrio(h, String(f.index ?? files.indexOf(f)), e.target.value)}>
                <option value="0">Skip</option>
                <option value="1">Normal</option>
                <option value="6">High</option>
                <option value="7">Max</option>
              </select>
              <div>
                <div className="tname">{f.name}</div>
                <div className="tmeta"><span>{fmtBytes(f.size)}</span><span>{(f.progress * 100).toFixed(0)}%</span></div>
              </div>
            </div>
          ))}

          {dtab === 'Trackers' && (
            <>
              {trackers.map(tr => (
                <div key={tr.url} className="filerow">
                  <div>
                    <div className="tname mono">{tr.url}</div>
                    <div className="tmeta">
                      <span>{['Disabled', 'Not contacted', 'Working', 'Updating', 'Error'][tr.status] || tr.status}</span>
                      <span>seeds {tr.num_seeds}</span><span>peers {tr.num_peers}</span>
                      {tr.msg && <span>{tr.msg}</span>}
                    </div>
                  </div>
                  {!tr.url.startsWith('**') && (
                    <button onClick={() => client.removeTrackers(h, tr.url)}>✕</button>
                  )}
                </div>
              ))}
              <button className="chip" onClick={async () => {
                const u = prompt('Tracker URL(s), one per line:')
                if (u) await client.addTrackers(h, u)
              }}>＋ Add tracker</button>
            </>
          )}

          {dtab === 'Peers' && Object.entries(peers).map(([k, p]) => (
            <div key={k} className="filerow">
              <div>
                <div className="tname mono">{p.ip}:{p.port} {p.flags && `[${p.flags}]`}</div>
                <div className="tmeta">
                  <span>{p.client}</span><span>↓ {fmtSpeed(p.dl_speed)}</span><span>↑ {fmtSpeed(p.up_speed)}</span>
                  <span>{(p.progress * 100).toFixed(0)}%</span>
                </div>
              </div>
              <button onClick={() => client.banPeers(`${p.ip}:${p.port}`)}>Ban</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
