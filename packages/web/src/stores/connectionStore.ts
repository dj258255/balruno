/**
 * Connection store — aggregates the sheet & doc sync channel statuses.
 *
 * The sidebar footer ConnectionStatus component reads `aggregate` to render a
 * single dot. Each sync hook (useSheetCellSync, useDocYjsCloudSync) calls
 * `setSheetStatus` / `setDocStatus` to publish their state.
 */

import { create } from 'zustand';

export type ChannelStatus = 'idle' | 'connecting' | 'connected' | 'offline' | 'error';

interface ChannelEntry {
  id: string | null;
  status: ChannelStatus;
}

interface ConnectionState {
  sheet: ChannelEntry;
  doc: ChannelEntry;

  setSheetStatus: (id: string | null, status: ChannelStatus) => void;
  setDocStatus: (id: string | null, status: ChannelStatus) => void;

  /** Highest-severity status across both channels. */
  aggregate: () => ChannelStatus;
}

const PRIORITY: Record<ChannelStatus, number> = {
  error: 5,
  offline: 4,
  connecting: 3,
  connected: 2,
  idle: 1,
};

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  sheet: { id: null, status: 'idle' },
  doc: { id: null, status: 'idle' },

  setSheetStatus: (id, status) => set({ sheet: { id, status } }),
  setDocStatus: (id, status) => set({ doc: { id, status } }),

  aggregate: () => {
    const { sheet, doc } = get();
    return PRIORITY[sheet.status] >= PRIORITY[doc.status] ? sheet.status : doc.status;
  },
}));
