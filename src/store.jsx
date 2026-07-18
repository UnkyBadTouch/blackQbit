import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { QbitClient } from './api/qbit.js'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v))

export function StoreProvider({ children }) {
  const [servers, setServers] = useState(() => load('servers', []))
  const [activeId, setActiveId] = useState(() => load('activeServer', null))
  const [theme, setTheme] = useState(() => load('theme', 'dark'))
  const [connected, setConnected] = useState(false)
  const [connError, setConnError] = useState(null)

  // sync/maindata state
  const [torrents, setTorrents] = useState({})
  const [categories, setCategories] = useState({})
  const [tags, setTags] = useState([])
  const [serverState, setServerState] = useState({})
  const [loaded, setLoaded] = useState(false) // first maindata received
  const ridRef = useRef(0)

  useEffect(() => { save('servers', servers) }, [servers])
  useEffect(() => { save('activeServer', activeId) }, [activeId])
  useEffect(() => {
    save('theme', theme)
    document.documentElement.dataset.theme = theme
  }, [theme])

  const active = servers.find(s => s.id === activeId) || null
  const client = useMemo(() => active ? new QbitClient(active.url, { insecure: active.insecure, timeout: active.timeout }) : null, [activeId, servers])

  const connect = useCallback(async () => {
    if (!client || !active) return
    setConnError(null)
    try {
      // Reuse an existing SID cookie when possible — qBittorrent bans IPs that log in too often.
      let haveSession = false
      try { await client.version(); haveSession = true } catch { /* no valid session */ }
      if (!haveSession && active.username) {
        const r = await client.login(active.username, active.password)
        if (r === 'Fails.') throw new Error('Login failed — check credentials')
        // Confirm the session cookie actually took before declaring connected,
        // otherwise a cookie problem turns into an endless connect/fail loop.
        await client.version().catch((e) => {
          throw new Error(`Logged in but session not accepted (cookie ${client.cookie ? 'captured' : 'NOT captured'}; ${e.message})`)
        })
      }
      ridRef.current = 0
      setTorrents({}); setCategories({}); setTags([]); setServerState({}); setLoaded(false)
      setConnected(true)
    } catch (e) {
      setConnected(false)
      setConnError(e.message)
    }
  }, [client, activeId])

  useEffect(() => { setConnected(false); if (client) connect() }, [client])

  // Reconnect automatically when the app comes back to the foreground.
  const connectedRef = useRef(false)
  connectedRef.current = connected
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === 'visible' && client && !connectedRef.current) connect()
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('online', onWake)
    window.addEventListener('focus', onWake)
    return () => {
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('online', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [client, connect])

  // polling loop
  useEffect(() => {
    if (!connected || !client) return
    let stop = false
    const tick = async () => {
      try {
        const d = await client.syncMaindata(ridRef.current)
        if (stop) return
        ridRef.current = d.rid
        if (d.full_update) {
          setTorrents(d.torrents || {})
          setCategories(d.categories || {})
          setTags(d.tags || [])
          setServerState(d.server_state || {})
        } else {
          if (d.torrents || d.torrents_removed) setTorrents(prev => {
            const next = { ...prev }
            for (const h of d.torrents_removed || []) delete next[h]
            for (const [h, t] of Object.entries(d.torrents || {})) next[h] = { ...next[h], ...t }
            return next
          })
          if (d.categories || d.categories_removed) setCategories(prev => {
            const next = { ...prev }
            for (const c of d.categories_removed || []) delete next[c]
            Object.assign(next, d.categories || {})
            return next
          })
          if (d.tags || d.tags_removed) setTags(prev => {
            const s = new Set(prev)
            for (const t of d.tags_removed || []) s.delete(t)
            for (const t of d.tags || []) s.add(t)
            return [...s]
          })
          if (d.server_state) setServerState(prev => ({ ...prev, ...d.server_state }))
        }
        setLoaded(true)
      } catch (e) {
        // Session expired (qBittorrent 403s after restart/timeout): reconnect after a
        // short delay — immediate retries flap forever when the session never sticks.
        if (!stop) { setConnected(false); setConnError(e.message); setTimeout(connect, 3000) }
      }
    }
    tick()
    const iv = setInterval(tick, 2000)
    return () => { stop = true; clearInterval(iv) }
  }, [connected, client, connect])

  const value = {
    servers, setServers, activeId, setActiveId, active, client,
    connected, connError, connect,
    theme, setTheme,
    torrents, categories, tags, serverState, loaded
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const fmtBytes = (b = 0) => {
  if (!b || b < 0) return '0 B'
  const u = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  const i = Math.min(u.length - 1, Math.floor(Math.log2(b) / 10))
  return `${(b / 2 ** (10 * i)).toFixed(i ? 1 : 0)} ${u[i]}`
}
export const fmtSpeed = b => fmtBytes(b) + '/s'
export const fmtEta = s => {
  if (s >= 8640000 || s < 0) return '∞'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h > 48 ? `${Math.floor(h / 24)}d` : h ? `${h}h ${m}m` : `${m}m ${s % 60}s`
}
