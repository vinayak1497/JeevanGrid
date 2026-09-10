import { apiFetch } from '../api/client';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Subscribe this browser to official-warning push for a district. */
export async function subscribeForDistrict(district: string): Promise<{ ok: boolean; message: string }> {
  if (!pushSupported()) {
    return { ok: false, message: 'Browser notifications are not supported on this device.' };
  }
  // District-level subscription first (works even if push is declined).
  await apiFetch('/alert-subscriptions', {
    method: 'POST',
    body: JSON.stringify({ district }),
  });
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    return { ok: true, message: 'District saved. Enable browser permission later to get push alerts.' };
  }
  const reg = await navigator.serviceWorker.register('/sw.js');
  const { vapidPublicKey } = await apiFetch<{ vapidPublicKey: string | null }>('/push/vapid-public-key');
  if (!vapidPublicKey) {
    return { ok: true, message: 'District saved. Push delivery is not configured on the server yet.' };
  }
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as ArrayBuffer,
  });
  const json = sub.toJSON();
  await apiFetch('/push-subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      district,
    }),
  });
  return { ok: true, message: `Push alerts enabled for ${district}. JeevanGrid relays official warnings only.` };
}
