import React, { useState } from 'react'
import { useStore } from '../store.jsx'

export default function AddTorrent() {
  const { client, connected, categories, tags } = useStore()
  const [urls, setUrls] = useState('')
  const [files, setFiles] = useState([])
  const [category, setCategory] = useState('')
  const [tagList, setTagList] = useState('')
  const [savepath, setSavepath] = useState('')
  const [paused, setPaused] = useState(false)
  const [sequential, setSequential] = useState(false)
  const [msg, setMsg] = useState(null)

  if (!connected) return <div className="empty">Not connected.</div>

  const submit = async e => {
    e.preventDefault()
    setMsg(null)
    const fd = new FormData()
    if (urls.trim()) fd.append('urls', urls.trim())
    for (const f of files) fd.append('torrents', f)
    if (savepath) fd.append('savepath', savepath)
    if (category) fd.append('category', category)
    if (tagList.trim()) fd.append('tags', tagList.trim())
    if (paused) { fd.append('paused', 'true'); fd.append('stopped', 'true') }
    if (sequential) fd.append('sequentialDownload', 'true')
    try {
      const r = await client.addTorrent(fd)
      if (r === 'Fails.') throw new Error('qBittorrent rejected the torrent')
      setMsg({ ok: true, text: 'Added ✓' })
      setUrls(''); setFiles([])
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <h2>Add torrent</h2>
      <label>Magnet links / URLs (one per line)
        <textarea rows={4} value={urls} onChange={e => setUrls(e.target.value)} placeholder="magnet:?xt=…" />
      </label>
      <label>.torrent files
        <input type="file" accept=".torrent" multiple onChange={e => setFiles([...e.target.files])} />
      </label>
      <label>Save path (optional)
        <input value={savepath} onChange={e => setSavepath(e.target.value)} placeholder="default" />
      </label>
      <label>Category
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">(none)</option>
          {Object.keys(categories).map(c => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label>Tags (comma separated)
        <input value={tagList} onChange={e => setTagList(e.target.value)} list="taglist" />
        <datalist id="taglist">{tags.map(t => <option key={t}>{t}</option>)}</datalist>
      </label>
      <label className="row"><input type="checkbox" checked={paused} onChange={e => setPaused(e.target.checked)} /> Add paused</label>
      <label className="row"><input type="checkbox" checked={sequential} onChange={e => setSequential(e.target.checked)} /> Sequential download</label>
      <button className="primary" disabled={!urls.trim() && !files.length}>Add</button>
      {msg && <div className={'banner ' + (msg.ok ? 'ok' : 'error')}>{msg.text}</div>}
    </form>
  )
}
