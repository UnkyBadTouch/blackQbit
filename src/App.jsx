import React, { useState } from 'react'
import { StoreProvider, useStore } from './store.jsx'
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
  { id: 'rss', label: 'RSS', icon: '📡' },
  { id: 'transfer', label: 'Transfer', icon: '📊' },
  { id: 'servers', label: 'Servers', icon: '🖥️' },
  { id: 'settings', label: 'Settings', icon: '⚙️' }
]

function Shell() {
  const [tab, setTab] = useState('torrents')
  const { active, connected, connError, connect } = useStore()

  const view = !active && tab !== 'servers' && tab !== 'settings'
    ? <Servers />
    : { torrents: <Torrents />, add: <AddTorrent />, search: <Search />, rss: <Rss />, transfer: <Transfer />, servers: <Servers />, settings: <Settings /> }[tab]

  return (
    <div className="shell">
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
