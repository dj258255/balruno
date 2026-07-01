/**
 * Connection store — tracks the sheet sync channel status.
 *
 * The sidebar footer ConnectionStatus component reads `aggregate` to render a
 * single dot. useProjectSync calls `setSheetStatus` to publish its state.
 * The "sheet" channel is the project-scoped op-log socket (sheet cell +
 * sheet tree, ADR 0008 v2.0).
 */

import { create } from 'zustand';

export type ChannelStatus = 'idle' | 'connecting' | 'connected' | 'offline' | 'error';

interface ChannelEntry {
  id: string | null;
  status: ChannelStatus;
}

interface ConnectionState {
  sheet: ChannelEntry;

  setSheetStatus: (id: string | null, status: ChannelStatus) => void;

  /** Current channel status. */
  aggregate: () => ChannelStatus;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  sheet: { id: null, status: 'idle' },

  setSheetStatus: (id, status) => set({ sheet: { id, status } }),

  aggregate: () => get().sheet.status,
}));
