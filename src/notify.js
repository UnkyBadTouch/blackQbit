import { LocalNotifications } from '@capacitor/local-notifications'
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service'

const native = !!globalThis.Capacitor?.isNativePlatform?.()

// Keep the app process alive while torrents download so background polling/notifications work.
let fgsRunning = false
export async function setForegroundService(on) {
  if (!native || on === fgsRunning) return
  fgsRunning = on
  try {
    if (on) {
      await ForegroundService.startForegroundService({
        id: 1000,
        title: 'blackQbit',
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

export async function requestNotifPermission() {
  try {
    if (native) await LocalNotifications.requestPermissions()
    else if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
  } catch { /* denied or unsupported */ }
}

let nextId = Math.floor(Date.now() / 1000) % 100000

export async function showNotification(title, body) {
  try {
    if (native) {
      await LocalNotifications.schedule({ notifications: [{ id: nextId++ % 100000, title, body }] })
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body })
    }
  } catch { /* best effort */ }
}
