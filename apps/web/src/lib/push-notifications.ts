/**
 * Web Push subscription management for the FreightX PWA.
 * Uses the Web Push API (VAPID) to subscribe/unsubscribe users.
 *
 * Prerequisites:
 *   - VITE_VAPID_PUBLIC_KEY env var set to the generated VAPID public key
 *   - Service worker registered at /sw.js with push event handler
 *   - push_subscriptions table created (migration 049)
 */
import { supabase } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function isPushSupported(): Promise<boolean> {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getPushPermission(): Promise<NotificationPermission> {
  return Notification.permission;
}

export async function subscribeToPush(): Promise<boolean> {
  try {
    if (!(await isPushSupported())) return false;

    const registration = await navigator.serviceWorker.ready;
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

    if (!vapidPublicKey) {
      console.warn('[push] VITE_VAPID_PUBLIC_KEY not set — push disabled');
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as ArrayBuffer,
    });

    const json = subscription.toJSON();
    const keys = json.keys as { p256dh: string; auth: string };

    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return false;

    const { error } = await db.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: json.endpoint!,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: navigator.userAgent,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );

    if (error) {
      console.error('[push] Failed to save subscription:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[push] subscribeToPush error:', err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await db.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    await subscription.unsubscribe();
  } catch (err) {
    console.error('[push] unsubscribeFromPush error:', err);
  }
}

export async function isSubscribedToPush(): Promise<boolean> {
  try {
    if (!(await isPushSupported())) return false;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}
