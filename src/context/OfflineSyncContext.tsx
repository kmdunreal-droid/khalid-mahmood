import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  clearAllSyncedOutbox,
  getAllOfflineSales,
  getAllOfflineShifts,
  getAllOutboxItems,
  getOfflineMetadata,
  getPendingOutboxCount,
  OfflineSaleRecord,
  OfflineShiftRecord,
  openOfflineDatabase,
  OutboxMutation,
  storeOfflineSale,
  storeOfflineShift,
  syncOfflineQueue,
  SyncResult,
} from '../services/offlineStorage';
import { SalesTransactionRecord } from '../data/salesTypes';
import { ShiftRecord } from '../data/shiftTypes';
import { useFirebaseAuth } from '../components/auth/FirebaseProvider';

interface OfflineSyncContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: Date | null;
  outboxItems: OutboxMutation[];
  syncResultNotice: string | null;
  clearNotice: () => void;
  syncNow: () => Promise<SyncResult>;
  clearSyncedItems: () => Promise<void>;
  recordSaleOfflineFirst: (
    sale: Omit<SalesTransactionRecord, 'id' | 'stationId' | 'operatorUid' | 'soldTimeLabel'>,
    stationId: string
  ) => Promise<{ sale: SalesTransactionRecord; isQueuedOffline: boolean }>;
  saveShiftOfflineFirst: (
    shift: ShiftRecord,
    action?: OutboxMutation['action'],
    stationId?: string
  ) => Promise<{ shift: ShiftRecord; isQueuedOffline: boolean }>;
  seedOfflineCacheIfEmpty: (
    seedShifts: ShiftRecord[],
    seedSales: SalesTransactionRecord[]
  ) => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export function useOfflineSync(): OfflineSyncContextValue {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error('useOfflineSync must be used within OfflineSyncProvider');
  }
  return ctx;
}

export const OfflineSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, userProfile } = useFirebaseAuth();

  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [outboxItems, setOutboxItems] = useState<OutboxMutation[]>([]);
  const [syncResultNotice, setSyncResultNotice] = useState<string | null>(null);

  const clearNotice = useCallback(() => setSyncResultNotice(null), []);

  const refreshOutbox = useCallback(async () => {
    try {
      const items = await getAllOutboxItems();
      setOutboxItems(items);
      const pending = items.filter(
        (i) => i.status === 'pending' || i.status === 'failed' || i.status === 'syncing'
      ).length;
      setPendingCount(pending);

      const lastSyncTimestamp = await getOfflineMetadata<number>('lastSyncAt');
      if (lastSyncTimestamp) {
        setLastSyncedAt(new Date(lastSyncTimestamp));
      }
    } catch (err) {
      console.warn('Failed to refresh outbox:', err);
    }
  }, []);

  const syncNow = useCallback(async (): Promise<SyncResult> => {
    if (isSyncing) {
      return { synced: 0, failed: 0, errors: ['Sync already in progress'] };
    }

    setIsSyncing(true);
    try {
      const result = await syncOfflineQueue(firebaseUser?.uid, userProfile?.displayName);
      await refreshOutbox();

      if (result.synced > 0 && result.failed === 0) {
        setSyncResultNotice(`All ${result.synced} offline record(s) synced to cloud.`);
      } else if (result.synced > 0 && result.failed > 0) {
        setSyncResultNotice(`Synced ${result.synced} record(s), ${result.failed} failed.`);
      } else if (result.failed > 0) {
        setSyncResultNotice(`Sync failed for ${result.failed} record(s). Will retry.`);
      }

      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, firebaseUser, userProfile, refreshOutbox]);

  // Online / Offline listener & Automatic Reconnection Sync
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Wait 1.2s after reconnection event to ensure network stack is fully active
      setTimeout(() => {
        syncNow();
      }, 1200);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleOutboxChange = () => {
      refreshOutbox();
    };

    const handleSyncCompleted = (e: Event) => {
      refreshOutbox();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('petrolops-outbox-changed', handleOutboxChange);
    window.addEventListener('petrolops-sync-completed', handleSyncCompleted);

    // Initial outbox check
    openOfflineDatabase().then(() => {
      refreshOutbox();
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('petrolops-outbox-changed', handleOutboxChange);
      window.removeEventListener('petrolops-sync-completed', handleSyncCompleted);
    };
  }, [refreshOutbox, syncNow]);

  const clearSyncedItems = useCallback(async () => {
    await clearAllSyncedOutbox();
    await refreshOutbox();
  }, [refreshOutbox]);

  const recordSaleOfflineFirst = useCallback(
    async (
      saleInput: Omit<SalesTransactionRecord, 'id' | 'stationId' | 'operatorUid' | 'soldTimeLabel'>,
      stationId: string
    ) => {
      const newId = `sale-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const opUid = firebaseUser?.uid || 'offline-op';
      const now = new Date();
      const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;

      const sale: SalesTransactionRecord = {
        ...saleInput,
        id: newId,
        stationId,
        operatorUid: opUid,
        operatorName: userProfile?.displayName || saleInput.operatorName || 'Forecourt Attendant',
        soldTimeLabel: timeLabel,
      };

      // Always save to IndexedDB first
      const queueOffline = !navigator.onLine || !firebaseUser;
      await storeOfflineSale(sale, true);
      await refreshOutbox();

      // If online and authenticated, attempt immediate sync
      if (navigator.onLine && firebaseUser) {
        setTimeout(() => {
          syncNow();
        }, 100);
        return { sale, isQueuedOffline: false };
      }

      return { sale, isQueuedOffline: true };
    },
    [firebaseUser, userProfile, refreshOutbox, syncNow]
  );

  const saveShiftOfflineFirst = useCallback(
    async (
      shift: ShiftRecord,
      action: OutboxMutation['action'] = 'CREATE_SHIFT',
      stationId = 'STN-HWY-04'
    ) => {
      await storeOfflineShift(shift, action, stationId);
      await refreshOutbox();

      if (navigator.onLine && firebaseUser) {
        setTimeout(() => {
          syncNow();
        }, 100);
        return { shift, isQueuedOffline: false };
      }

      return { shift, isQueuedOffline: true };
    },
    [firebaseUser, refreshOutbox, syncNow]
  );

  const seedOfflineCacheIfEmpty = useCallback(
    async (seedShifts: ShiftRecord[], seedSales: SalesTransactionRecord[]) => {
      try {
        const existingShifts = await getAllOfflineShifts();
        if (existingShifts.length === 0 && seedShifts.length > 0) {
          for (const s of seedShifts) {
            await storeOfflineShift(s);
          }
        }

        const existingSales = await getAllOfflineSales();
        if (existingSales.length === 0 && seedSales.length > 0) {
          for (const sa of seedSales) {
            await storeOfflineSale(sa, false);
          }
        }
      } catch (err) {
        console.warn('Offline cache seeding non-blocking error:', err);
      }
    },
    []
  );

  return (
    <OfflineSyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        lastSyncedAt,
        outboxItems,
        syncResultNotice,
        clearNotice,
        syncNow,
        clearSyncedItems,
        recordSaleOfflineFirst,
        saveShiftOfflineFirst,
        seedOfflineCacheIfEmpty,
      }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
};
