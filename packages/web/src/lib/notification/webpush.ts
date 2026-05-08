/**
 * Browser-side Web Push subscription helpers (ADR 0024 Stage I).
 *
 * Flow:
 *   1. Register the SW (/sw.js) — done lazily by ensureRegistration()
 *      so it doesn't block the main bundle on every page load.
 *   2. Request notification permission.
 *   3. Subscribe with the VAPID public key from the backend.
 *   4. POST the subscription handle (endpoint + p256dh + auth) to
 *      the backend so the server can deliver pushes.
 *
 * Browsers that don't support Push (Safari < 16.4, in-app webviews)
 * just return false; the prefs UI hides the toggle in that case.
 */

import {
  fetchVapidPublicKey,
  saveWebPushSubscription,
} from '@/lib/backend/notification';

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker not supported');
  }
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

/**
 * Request permission, register the SW, subscribe via the VAPID key,
 * persist the subscription handle on the backend. Returns true on
 * success, throws on a hard failure (the caller surfaces toast).
 *
 * Idempotent: if the browser already has an active subscription for
 * the SW, we re-extract the keys and re-POST — the backend upserts
 * by (user, endpoint).
 */
export async function enableWebPush(): Promise<boolean> {
  if (!isWebPushSupported()) return false;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const registration = await ensureRegistration();

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const { publicKey } = await fetchVapidPublicKey();
    if (!publicKey) {
      throw new Error('Server VAPID key not configured');
    }
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // The Push API spec requires an ArrayBuffer-backed view; we
      // copy into a fresh Uint8Array.buffer to satisfy the strictest
      // TS lib.dom typings (which reject SharedArrayBuffer-backed views).
      applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
    });
  }

  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    throw new Error('PushSubscription is missing keys');
  }
  await saveWebPushSubscription({ endpoint, p256dh, auth });
  return true;
}

export async function disableWebPush(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }
  // The DB row stays until the user explicitly deletes it from the
  // prefs UI (or until the browser drops it and the server gets a
  // 410 Gone on next push). Cheap to keep — single row per device.
}

/** Web Push spec encodes the application server key as URL-safe
 *  base64; the SubscribeOptions API wants a Uint8Array. Standard
 *  conversion every Web Push tutorial copies. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const padded = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    out[i] = raw.charCodeAt(i);
  }
  return out;
}
