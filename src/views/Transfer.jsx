import React from 'react'
import { useStore, fmtBytes, fmtSpeed } from '../store.jsx'

export default function Transfer() {
  const { client, connected, serverState: s } = useStore()
  if (!connected) return <div className="empty">Not connected.</div>

  const setLimit = async (which) => {
    const cur = which === 'dl' ? s.dl_rate_limit : s.up_rate_limit
    const v = prompt(`${which === 'dl' ? 'Download' : 'Upload'} limit in KiB/s (0 = unlimited):`, Math.round((cur || 0) / 1024))
    if (v === null) return
    const bytes = Math.max(0, parseInt(v, 10) || 0) * 1024
    await (which === 'dl' ? client.setDownloadLimit(bytes) : client.setUploadLimit(bytes))
  }

  return (
    <div className="form">
      <h2>Transfer</h2>
      <div className="statgrid">
        <div className="stat"><b>↓ {fmtSpeed(s.dl_info_speed)}</b><span>session {fmtBytes(s.dl_info_data)}</span></div>
        <div className="stat"><b>↑ {fmtSpeed(s.up_info_speed)}</b><span>session {fmtBytes(s.up_info_data)}</span></div>
        <div className="stat"><b>{s.dht_nodes ?? '–'}</b><span>DHT nodes</span></div>
        <div className="stat"><b>{s.connection_status || '–'}</b><span>connection</span></div>
        <div className="stat"><b>{fmtBytes(s.alltime_dl)}</b><span>all-time down</span></div>
        <div className="stat"><b>{fmtBytes(s.alltime_ul)}</b><span>all-time up</span></div>
        <div className="stat"><b>{s.global_ratio ?? '–'}</b><span>global ratio</span></div>
        <div className="stat"><b>{fmtBytes(s.free_space_on_disk)}</b><span>free space</span></div>
      </div>

      <h3>Speed limits</h3>
      <div className="chiprow">
        <button className="chip" onClick={() => setLimit('dl')}>
          ↓ limit: {s.dl_rate_limit ? fmtSpeed(s.dl_rate_limit) : 'unlimited'}
        </button>
        <button className="chip" onClick={() => setLimit('up')}>
          ↑ limit: {s.up_rate_limit ? fmtSpeed(s.up_rate_limit) : 'unlimited'}
        </button>
        <button className={'chip' + (s.use_alt_speed_limits ? ' on' : '')}
          onClick={() => client.toggleSpeedLimitsMode()}>
          🐢 Alternative limits {s.use_alt_speed_limits ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  )
}
