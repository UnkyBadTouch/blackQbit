import React, { useEffect, useState } from 'react'
import { useStore } from '../store.jsx'

const TABS = {
  Behavior: [
    ['Language', [
      ['locale', 'Language (locale code)', 'text']
    ]],
    ['Torrent management', [
      ['torrent_content_layout', 'Torrent content layout', 'select', { valueType: 'string', options: [['Original', 'Original'], ['Subfolder', 'Create subfolder'], ['NoSubfolder', "Don't create subfolder"]] }],
      ['auto_tmm_enabled', 'Automatic torrent management by default', 'bool'],
      ['category_changed_tmm_enabled', "Relocate torrent when category's save path changes", 'bool'],
      ['save_path_changed_tmm_enabled', 'Relocate torrent when default save path changes', 'bool'],
      ['torrent_changed_tmm_enabled', 'Relocate torrent when category changes', 'bool'],
      ['start_paused_enabled', 'Add torrents in stopped state', 'bool'],
      ['preallocate_all', 'Pre-allocate disk space for all files', 'bool'],
      ['incomplete_files_ext', 'Append .!qB extension to incomplete files', 'bool']
    ]],
    ['Email notification', [
      ['mail_notification_enabled', 'Enabled', 'bool'],
      ['mail_notification_sender', 'From', 'text'],
      ['mail_notification_email', 'To', 'text'],
      ['mail_notification_smtp', 'SMTP server', 'text'],
      ['mail_notification_ssl_enabled', 'Require SSL', 'bool'],
      ['mail_notification_auth_enabled', 'Require authentication', 'bool'],
      ['mail_notification_username', 'Username', 'text'],
      ['mail_notification_password', 'Password', 'password']
    ]],
    ['Run external program', [
      ['autorun_enabled', 'Run on torrent added/completed', 'bool'],
      ['autorun_program', 'Program', 'text']
    ]]
  ],
  Downloads: [
    ['Save path', [
      ['save_path', 'Default save path', 'text'],
      ['temp_path_enabled', 'Use incomplete folder', 'bool'],
      ['temp_path', 'Incomplete folder', 'text'],
      ['export_dir', 'Copy .torrent files to', 'text'],
      ['export_dir_fin', 'Copy .torrent files for finished downloads to', 'text']
    ]],
    ['Trackers', [
      ['add_trackers_enabled', 'Add trackers to new torrents', 'bool'],
      ['add_trackers', 'Trackers to add (one per line)', 'textarea', { rows: 4 }]
    ]]
  ],
  Connection: [
    ['Listening port', [
      ['listen_port', 'Port', 'number'],
      ['random_port', 'Use random port on start', 'bool'],
      ['upnp', 'UPnP / NAT-PMP port forwarding', 'bool']
    ]],
    ['Connection limits', [
      ['max_connec', 'Global max connections', 'number'],
      ['max_connec_per_torrent', 'Max connections per torrent', 'number'],
      ['max_uploads', 'Global max upload slots', 'number'],
      ['max_uploads_per_torrent', 'Max upload slots per torrent', 'number']
    ]],
    ['Proxy server', [
      ['proxy_type', 'Type', 'select', { valueType: 'string', options: [['None', 'None'], ['HTTP', 'HTTP'], ['SOCKS4', 'SOCKS4'], ['SOCKS5', 'SOCKS5']] }],
      ['proxy_ip', 'Host', 'text'],
      ['proxy_port', 'Port', 'number'],
      ['proxy_auth_enabled', 'Authentication', 'bool'],
      ['proxy_username', 'Username', 'text'],
      ['proxy_password', 'Password', 'password'],
      ['proxy_hostname_lookup', 'Use proxy for hostname lookups', 'bool'],
      ['proxy_peer_connections', 'Use proxy for peer connections', 'bool']
    ]]
  ],
  Speed: [
    ['Global rate limits', [
      ['dl_limit', 'Download limit (KiB/s, 0 = unlimited)', 'number'],
      ['up_limit', 'Upload limit (KiB/s, 0 = unlimited)', 'number'],
      ['limit_utp_rate', 'Apply rate limit to µTP protocol', 'bool'],
      ['limit_tcp_overhead', 'Apply rate limit to transport overhead', 'bool'],
      ['limit_lan_peers', 'Apply rate limit to peers on LAN', 'bool']
    ]],
    ['Alternative rate limits', [
      ['alt_dl_limit', 'Alt download limit (KiB/s)', 'number'],
      ['alt_up_limit', 'Alt upload limit (KiB/s)', 'number']
    ]],
    ['Scheduling', [
      ['scheduler_enabled', 'Schedule alternative limits', 'bool'],
      ['schedule_from_hour', 'From hour', 'number'],
      ['schedule_from_min', 'From minute', 'number'],
      ['schedule_to_hour', 'To hour', 'number'],
      ['schedule_to_min', 'To minute', 'number'],
      ['scheduler_days', 'Days', 'select', {
        valueType: 'number',
        options: [[0, 'Every day'], [1, 'Every weekday'], [2, 'Every weekend'], [3, 'Monday'], [4, 'Tuesday'], [5, 'Wednesday'], [6, 'Thursday'], [7, 'Friday'], [8, 'Saturday'], [9, 'Sunday']]
      }]
    ]]
  ],
  BitTorrent: [
    ['Privacy', [
      ['dht', 'Enable DHT', 'bool'],
      ['pex', 'Enable PeX', 'bool'],
      ['lsd', 'Enable local peer discovery', 'bool'],
      ['encryption', 'Encryption', 'select', { valueType: 'number', options: [[0, 'Prefer encryption'], [1, 'Require encryption'], [2, 'Disable encryption']] }],
      ['anonymous_mode', 'Enable anonymous mode', 'bool']
    ]],
    ['Protocol', [
      ['bittorrent_protocol', 'Protocol', 'select', { valueType: 'number', options: [[0, 'TCP and µTP'], [1, 'TCP only'], [2, 'µTP only']] }]
    ]],
    ['Torrent queueing', [
      ['queueing_enabled', 'Enable queueing', 'bool'],
      ['max_active_downloads', 'Max active downloads', 'number'],
      ['max_active_uploads', 'Max active uploads', 'number'],
      ['max_active_torrents', 'Max active torrents', 'number'],
      ['dont_count_slow_torrents', "Don't count slow torrents against limits", 'bool'],
      ['slow_torrent_dl_rate_threshold', 'Slow torrent DL threshold (KiB/s)', 'number'],
      ['slow_torrent_ul_rate_threshold', 'Slow torrent UL threshold (KiB/s)', 'number'],
      ['slow_torrent_inactive_timer', 'Slow torrent inactivity timer (sec)', 'number']
    ]],
    ['Seeding limits', [
      ['max_ratio_enabled', 'Limit share ratio', 'bool'],
      ['max_ratio', 'Max ratio', 'number'],
      ['max_ratio_act', 'When ratio reached', 'select', { valueType: 'number', options: [[0, 'Pause torrent'], [1, 'Remove torrent']] }],
      ['max_seeding_time_enabled', 'Limit seeding time', 'bool'],
      ['max_seeding_time', 'Max seeding time (min)', 'number']
    ]]
  ],
  RSS: [
    ['RSS reader', [
      ['rss_refresh_interval', 'Refresh interval (min)', 'number'],
      ['rss_max_articles_per_feed', 'Max articles per feed', 'number'],
      ['rss_processing_enabled', 'Enable fetching RSS feeds', 'bool']
    ]],
    ['RSS auto-downloader', [
      ['rss_auto_downloading_enabled', 'Enable auto-downloading', 'bool'],
      ['rss_download_repack_proper_episodes', 'Download repack/proper episodes', 'bool'],
      ['rss_smart_episode_filters', 'Smart episode filters (one per line)', 'textarea', { rows: 3 }]
    ]]
  ],
  'Web UI': [
    ['HTTP server', [
      ['web_ui_address', 'IP address', 'text'],
      ['web_ui_port', 'Port', 'number'],
      ['web_ui_upnp', 'UPnP for WebUI port', 'bool'],
      ['web_ui_domain_list', 'Domain name whitelist', 'text'],
      ['use_https', 'Use HTTPS', 'bool'],
      ['web_ui_https_cert_path', 'Certificate path', 'text'],
      ['web_ui_https_key_path', 'Key path', 'text']
    ]],
    ['Authentication', [
      ['web_ui_username', 'Username', 'text'],
      ['web_ui_password', 'New password (leave blank to keep current)', 'password'],
      ['bypass_local_auth', 'Bypass auth for clients on localhost', 'bool'],
      ['bypass_auth_subnet_whitelist_enabled', 'Bypass auth for whitelisted subnets', 'bool'],
      ['bypass_auth_subnet_whitelist', 'Whitelisted subnets', 'text'],
      ['web_ui_max_auth_fail_count', 'Max auth failures before ban', 'number'],
      ['web_ui_ban_duration', 'Ban duration (sec)', 'number'],
      ['web_ui_session_timeout', 'Session timeout (sec)', 'number']
    ]],
    ['Security', [
      ['web_ui_csrf_protection_enabled', 'CSRF protection', 'bool'],
      ['web_ui_clickjacking_protection_enabled', 'Clickjacking protection', 'bool'],
      ['web_ui_secure_cookie_enabled', 'Secure cookie (HTTPS only)', 'bool'],
      ['web_ui_host_header_validation_enabled', 'Host header validation', 'bool']
    ]],
    ['Alternative WebUI', [
      ['alternative_webui_enabled', 'Use alternative WebUI', 'bool'],
      ['alternative_webui_path', 'Files location', 'text']
    ]],
    ['Dynamic DNS', [
      ['dyndns_enabled', 'Enable', 'bool'],
      ['dyndns_service', 'Service', 'select', { valueType: 'number', options: [[0, 'DynDNS'], [1, 'NO-IP']] }],
      ['dyndns_username', 'Username', 'text'],
      ['dyndns_password', 'Password', 'password'],
      ['dyndns_domain', 'Domain', 'text']
    ]]
  ]
}

const TAB_NAMES = Object.keys(TABS)

// qBittorrent preferences editor for the active server.
export default function Prefs({ notify }) {
  const { client } = useStore()
  const [prefs, setPrefs] = useState(null)
  const [dirty, setDirty] = useState({})
  const [tab, setTab] = useState(TAB_NAMES[0])

  useEffect(() => {
    client.preferences().then(p => { setPrefs(p); setDirty({}) }).catch(e => notify(false, e.message))
  }, [client])

  const val = k => (k in dirty ? dirty[k] : prefs?.[k])
  const setVal = (k, v) => setDirty(d => ({ ...d, [k]: v }))

  const savePrefs = async () => {
    try {
      await client.setPreferences(dirty)
      notify(true, 'Preferences saved ✓')
      setPrefs({ ...prefs, ...dirty }); setDirty({})
    } catch (e) { notify(false, e.message) }
  }

  if (!prefs) return <p className="hint">Loading…</p>

  const field = ([key, label, type, extra]) => {
    if (type === 'bool') return (
      <label key={key} className="row">
        <input type="checkbox" checked={!!val(key)} onChange={e => setVal(key, e.target.checked)} />
        {label}
      </label>
    )
    if (type === 'select') return (
      <label key={key}>{label}
        <select value={val(key) ?? extra.options[0][0]}
          onChange={e => setVal(key, extra.valueType === 'string' ? e.target.value : Number(e.target.value))}>
          {extra.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
    )
    if (type === 'textarea') return (
      <label key={key}>{label}
        <textarea rows={extra?.rows || 3} value={val(key) ?? ''} onChange={e => setVal(key, e.target.value)} />
      </label>
    )
    return (
      <label key={key}>{label}
        <input type={type} value={val(key) ?? ''} onChange={e => setVal(key, type === 'number' ? Number(e.target.value) : e.target.value)} />
      </label>
    )
  }

  return <>
    <div className="chiprow tabs">
      {TAB_NAMES.map(t => (
        <button key={t} className={'chip' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>{t}</button>
      ))}
    </div>
    {TABS[tab].map(([section, fields]) => (
      <React.Fragment key={section}>
        <h3>{section}</h3>
        {fields.map(field)}
      </React.Fragment>
    ))}
    <div className="chiprow">
      <button className="primary" disabled={!Object.keys(dirty).length} onClick={savePrefs}>
        Save {Object.keys(dirty).length ? `(${Object.keys(dirty).length} changed)` : ''}
      </button>
    </div>
  </>
}
