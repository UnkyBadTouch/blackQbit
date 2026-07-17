import React, { useState } from 'react'
import { StoreProvider, useStore, fmtSpeed } from './store.jsx'
import Torrents from './views/Torrents.jsx'
import AddTorrent from './views/AddTorrent.jsx'
import Transfer from './views/Transfer.jsx'
import Settings from './views/Settings.jsx'
import Servers from './views/Servers.jsx'
import Rss from './views/Rss.jsx'
import Search from './views/Search.jsx'

const TABS = [
  { id: 'torrents', label: 'Torrents', icon: '📥' },
  { id: 'add', label: 'Add', icon: '➕' },
  { id: 'search', label: 'Search', icon: '🔍' },
  { id: 'rss', label: 'RSS', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#f78422" />
      <circle cx="6.5" cy="17.5" r="2.3" fill="#fff" />
      <path d="M4 10.5a9.5 9.5 0 0 1 9.5 9.5h-3A6.5 6.5 0 0 0 4 13.5Z" fill="#fff" />
      <path d="M4 4.5A15.5 15.5 0 0 1 19.5 20h-3A12.5 12.5 0 0 0 4 7.5Z" fill="#fff" />
    </svg>
  ) },
  { id: 'transfer', label: 'Transfer', icon: '📊' },
  { id: 'servers', label: 'Servers', icon: '🖥️' },
  { id: 'settings', label: 'Settings', icon: '⚙️' }
]

function Shell() {
  const [tab, setTab] = useState('torrents')
  const { active, connected, connError, connect, serverState } = useStore()

  const view = !active && tab !== 'servers' && tab !== 'settings'
    ? <Servers />
    : { torrents: <Torrents />, add: <AddTorrent />, search: <Search />, rss: <Rss />, transfer: <Transfer />, servers: <Servers />, settings: <Settings /> }[tab]

  return (
    <div className="shell">
      <header className="topbar">
        <span className="wordmark">black<b>Q</b>bit</span>
        {active && (
          <span className="topstatus">
            <span className={'dot' + (connected ? ' live' : '')} />
            {active.name}
            {connected && <>
              <span className="spd dl">↓ {fmtSpeed(serverState.dl_info_speed)}</span>
              <span className="spd ul">↑ {fmtSpeed(serverState.up_info_speed)}</span>
            </>}
          </span>
        )}
      </header>
      {active && !connected && connError && (
        <div className="banner error">
          {connError} <button onClick={connect}>Retry</button>
        </div>
      )}
      <main className="content">{view}</main>
      <nav className="bottomnav">
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>
}
