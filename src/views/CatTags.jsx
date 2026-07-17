import React, { useState } from 'react'
import { useStore } from '../store.jsx'

// Category & tag manager for the active server.
export default function CatTags({ notify }) {
  const { client, categories, tags } = useStore()
  const [editCat, setEditCat] = useState(null)
  const [catPath, setCatPath] = useState('')
  const [newCat, setNewCat] = useState('')
  const [newCatPath, setNewCatPath] = useState('')
  const [newTag, setNewTag] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)

  const run = async fn => {
    try { await fn() } catch (e) { notify(false, e.message) }
    setConfirmDel(null)
  }

  return <>
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
  </>
}
