import { LocalNotifications } from '@capacitor/local-notifications'
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service'
import { BackgroundRunner } from '@capacitor/background-runner'

const native = !!globalThis.Capacitor?.isNativePlatform?.()
const BG_LABEL = 'com.pineapplesoftwareinc.qbittorrent.check'

// Fallback for when the WebView's own timers are frozen in the background: pushes the
// current server/cookie/prefs into the background runner's KV store so its 15-min native
// check (qbit-runner.js) has something to work with. Fire-and-forget — see plugin docs,
// dispatchEvent may not resolve while the app is in the foreground.
export async function pushBgConfig({ serverUrl, cookie, notifComplete }) {
  if (!native) return
  try {
    await BackgroundRunner.requestPermissions({ apis: ['notifications'] })
    BackgroundRunner.dispatchEvent({ label: BG_LABEL, event: 'configUpdate', details: { serverUrl, cookie, notifComplete } })
  } catch { /* best effort */ }
}

// Keep the app process alive while torrents download so background polling/notifications work.
let fgsRunning = false
export async function setForegroundService(on) {
  if (!native || on === fgsRunning) return
  fgsRunning = on
  try {
    if (on) {
      await ForegroundService.startForegroundService({
        id: 1000,
        title: 'pineappleQbit',
        body: 'Monitoring downloads',
        smallIcon: 'ic_stat_notify',
        silent: true,
        serviceType: 1 // FOREGROUND_SERVICE_TYPE_DATA_SYNC
      })
    } else {
      await ForegroundService.stopForegroundService()
    }
  } catch {
    fgsRunning = !on
  }
}

// Default importance = lands quietly in the shade, no heads-up banner or sound. New channel
// id (Android caches importance per-id forever, so bumping importance alone wouldn't touch
// existing installs) — same id used by the background-runner fallback (qbit-runner.js) so
// both notification paths get the same treatment.
export const DOWNLOAD_CHANNEL_ID = 'downloads_silent'

export async function requestNotifPermission() {
  try {
    if (native) {
      await LocalNotifications.requestPermissions()
      await LocalNotifications.createChannel({ id: DOWNLOAD_CHANNEL_ID, name: 'Downloads', importance: 3, visibility: 1 })
    } else if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  } catch { /* denied, unsupported, or channel already exists */ }
}

let nextId = Math.floor(Date.now() / 1000) % 100000

export async function showNotification(title, body) {
  try {
    if (native) {
      await LocalNotifications.schedule({ notifications: [{ id: nextId++ % 100000, title, body, channelId: DOWNLOAD_CHANNEL_ID }] })
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, silent: true })
    }
  } catch { /* best effort */ }
}
