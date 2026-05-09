'use client';

/**
 * Standalone account-settings page (`/settings/account`). Mounts
 * the same AccountSettingsClient that the workspace switcher uses
 * as a centered modal — page mode here, modal mode there.
 */

import AccountSettingsClient from '@/app/components/AccountSettingsClient';

export default function AccountSettingsPage() {
  return <AccountSettingsClient />;
}
