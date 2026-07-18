import { LocalNotifications } from '@capacitor/local-notifications'

const native = !!globalThis.Capacitor?.isNativePlatform?.()

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
