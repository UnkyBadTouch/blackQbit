import React, { useState } from 'react'
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

// qBittorrent preferences editor for the active server.
export default function Prefs({ notify }) {
  const { client } = useStore()
  const [prefs, setPrefs] = useState(null)
  const [dirty, setDirty] = useState({})
  const [open, setOpen] = useState(false)

  const val = k => (k in dirty ? dirty[k] : prefs?.[k])

  const openPrefs = async () => {
    try { setPrefs(await client.preferences()); setDirty({}); setOpen(true) }
    catch (e) { notify(false, e.message) }
  }

  const savePrefs = async () => {
    try {
      await client.setPreferences(dirty)
      notify(true, 'Preferences saved ✓')
      setPrefs({ ...prefs, ...dirty }); setDirty({})
    } catch (e) { notify(false, e.message) }
  }

  if (!open) return <button onClick={openPrefs}>Edit qBittorrent preferences</button>

  return <>
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
      <button onClick={() => setOpen(false)}>Close</button>
    </div>
  </>
}
