'use client';

/**
 * Standalone notification-settings page (`/settings/notifications`).
 * Mounts the same NotificationSettingsClient that the workspace
 * switcher uses as a centered modal — page mode here, modal mode
 * there.
 */

import NotificationSettingsClient from '@/app/components/NotificationSettingsClient';

export default function NotificationSettingsPage() {
  return <NotificationSettingsClient />;
}
