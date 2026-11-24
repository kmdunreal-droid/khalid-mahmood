/**
 * IndexedDB Offline Storage and Sync Engine for PetrolOps Studio
 * Provides resilient local persistence for critical operations (Sales & Shifts)
 * with an outbox queue that automatically synchronizes when connection is restored.
 */

import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { SalesTransactionRecord } from '../data/salesTypes';
import { ShiftRecord, ShiftExpense } from '../data/shiftTypes';
import { db } from '../firebase';

const DB_NAME = 'petrolops_offline_db';
const DB_VERSION = 1;

export interface OutboxMutation {
  id: string;
  module: 'sales' | 'shifts';
  action:
    | 'CREATE_SALE'
    | 'CREATE_SHIFT'
    | 'UPDATE_NOZZLE_METERS'
    | 'ADD_SHIFT_EXPENSE'
    | 'SUBMIT_SHIFT_HANDOVER'
    | 'APPROVE_SHIFT'
    | 'REJECT_SHIFT';
  stationId: string;
  payload: any;
  createdAt: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  errorMessage?: string;
}

export interface OfflineSaleRecord extends SalesTransactionRecord {
  syncStatus?: 'synced' | 'pending' | 'failed';
  localCachedAt?: number;
}

export interface OfflineShiftRecord extends ShiftRecord {
  syncStatus?: 'synced' | 'pending' | 'failed';
  localCachedAt?: number;
}

let dbInstance: IDBDatabase | null = null;

export function openOfflineDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Sales Store
      if (!db.objectStoreNames.contains('sales')) {
        const salesStore = db.createObjectStore('sales', { keyPath: 'id' });
        salesStore.createIndex('stationId', 'stationId', { unique: false });
        salesStore.createIndex('shiftId', 'shiftId', { unique: false });
        salesStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        salesStore.createIndex('soldDate', 'soldDate', { unique: false });
      }

      // Shifts Store
      if (!db.objectStoreNames.contains('shifts')) {
        const shiftsStore = db.createObjectStore('shifts', { keyPath: 'id' });
        shiftsStore.createIndex('stationId', 'stationId', { unique: false });
        shiftsStore.createIndex('status', 'status', { unique: false });
        shiftsStore.createIndex('businessDate', 'businessDate', { unique: false });
        shiftsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
      }

      // Outbox Mutation Queue Store
      if (!db.objectStoreNames.contains('outbox')) {
        const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' });
        outboxStore.createIndex('module', 'module', { unique: false });
        outboxStore.createIndex('status', 'status', { unique: false });
        outboxStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Metadata / Settings Store
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

// ======================== SALES STORAGE ========================

export async function storeOfflineSale(
  sale: SalesTransactionRecord,
  queueForSync = true
): Promise<OfflineSaleRecord> {
  const db = await openOfflineDatabase();
  const offlineSale: OfflineSaleRecord = {
    ...sale,
    syncStatus: queueForSync ? 'pending' : 'synced',
    localCachedAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sales', 'outbox'], 'readwrite');
    const salesStore = tx.objectStore('sales');
    salesStore.put(offlineSale);

    if (queueForSync) {
      const outboxStore = tx.objectStore('outbox');
      const mutation: OutboxMutation = {
        id: `mut-sale-${sale.id}`,
        module: 'sales',
        action: 'CREATE_SALE',
        stationId: sale.stationId,
        payload: sale,
        createdAt: Date.now(),
        retryCount: 0,
        status: 'pending',
      };
      outboxStore.put(mutation);
    }

    tx.oncomplete = () => {
      notifyQueueUpdated();
      resolve(offlineSale);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllOfflineSales(stationId?: string): Promise<OfflineSaleRecord[]> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sales', 'readonly');
    const store = tx.objectStore('sales');
    const request = store.getAll();

    request.onsuccess = () => {
      const records = (request.result || []) as OfflineSaleRecord[];
      if (stationId) {
        resolve(records.filter((r) => r.stationId === stationId));
      } else {
        resolve(records);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateOfflineSaleSyncStatus(
  saleId: string,
  syncStatus: 'synced' | 'pending' | 'failed'
): Promise<void> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sales', 'readwrite');
    const store = tx.objectStore('sales');
    const getReq = store.get(saleId);

    getReq.onsuccess = () => {
      const record = getReq.result as OfflineSaleRecord;
      if (record) {
        record.syncStatus = syncStatus;
        store.put(record);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// ======================== SHIFT STORAGE ========================

export async function storeOfflineShift(
  shift: ShiftRecord,
  queueAction?: OutboxMutation['action'],
  stationId = 'STN-HWY-04'
): Promise<OfflineShiftRecord> {
  const db = await openOfflineDatabase();
  const offlineShift: OfflineShiftRecord = {
    ...shift,
    syncStatus: queueAction ? 'pending' : 'synced',
    localCachedAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const stores: ('shifts' | 'outbox')[] = queueAction ? ['shifts', 'outbox'] : ['shifts'];
    const tx = db.transaction(stores, 'readwrite');
    const shiftsStore = tx.objectStore('shifts');
    shiftsStore.put(offlineShift);

    if (queueAction) {
      const outboxStore = tx.objectStore('outbox');
      const mutation: OutboxMutation = {
        id: `mut-shift-${shift.id}-${queueAction.toLowerCase()}-${Date.now()}`,
        module: 'shifts',
        action: queueAction,
        stationId,
        payload: shift,
        createdAt: Date.now(),
        retryCount: 0,
        status: 'pending',
      };
      outboxStore.put(mutation);
    }

    tx.oncomplete = () => {
      notifyQueueUpdated();
      resolve(offlineShift);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllOfflineShifts(stationId?: string): Promise<OfflineShiftRecord[]> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shifts', 'readonly');
    const store = tx.objectStore('shifts');
    const request = store.getAll();

    request.onsuccess = () => {
      const records = (request.result || []) as OfflineShiftRecord[];
      if (stationId) {
        resolve(records.filter((r) => !r.id || r.id.includes(stationId) || true));
      } else {
        resolve(records);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineShiftById(shiftId: string): Promise<OfflineShiftRecord | null> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shifts', 'readonly');
    const store = tx.objectStore('shifts');
    const req = store.get(shiftId);

    req.onsuccess = () => resolve((req.result as OfflineShiftRecord) || null);
    req.onerror = () => reject(req.error);
  });
}

// ======================== OUTBOX QUEUE ========================

export async function getAllOutboxItems(): Promise<OutboxMutation[]> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readonly');
    const store = tx.objectStore('outbox');
    const request = store.getAll();

    request.onsuccess = () => {
      const items = (request.result || []) as OutboxMutation[];
      // Sort oldest first (FIFO)
      items.sort((a, b) => a.createdAt - b.createdAt);
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingOutboxCount(): Promise<number> {
  const items = await getAllOutboxItems();
  return items.filter((i) => i.status === 'pending' || i.status === 'failed' || i.status === 'syncing').length;
}

export async function updateOutboxItem(item: OutboxMutation): Promise<void> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    store.put(item);
    tx.oncomplete = () => {
      notifyQueueUpdated();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeOutboxItem(id: string): Promise<void> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    store.delete(id);
    tx.oncomplete = () => {
      notifyQueueUpdated();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllSyncedOutbox(): Promise<number> {
  const items = await getAllOutboxItems();
  const synced = items.filter((i) => i.status === 'synced');
  for (const item of synced) {
    await removeOutboxItem(item.id);
  }
  return synced.length;
}

// ======================== METADATA ========================

export async function setOfflineMetadata(key: string, value: any): Promise<void> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('metadata', 'readwrite');
    const store = tx.objectStore('metadata');
    store.put({ key, value, updatedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineMetadata<T = any>(key: string): Promise<T | null> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('metadata', 'readonly');
    const store = tx.objectStore('metadata');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? (req.result.value as T) : null);
    req.onerror = () => reject(req.error);
  });
}

// ======================== SYNC ENGINE ========================

function notifyQueueUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('petrolops-outbox-changed'));
  }
}

export interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

/**
 * Synchronizes pending outbox items to Cloud Firestore.
 * Executes FIFO to preserve business logic order (Shift creation -> Sales -> Handover -> Approval).
 */
export async function syncOfflineQueue(
  firebaseUserId?: string,
  userDisplayName?: string
): Promise<SyncResult> {
  const items = await getAllOutboxItems();
  const pendingItems = items.filter(
    (i) => i.status === 'pending' || i.status === 'failed' || i.status === 'syncing'
  );

  const result: SyncResult = {
    synced: 0,
    failed: 0,
    errors: [],
  };

  if (pendingItems.length === 0) {
    return result;
  }

  for (const item of pendingItems) {
    try {
      item.status = 'syncing';
      await updateOutboxItem(item);

      if (item.action === 'CREATE_SALE') {
        const sale = item.payload as SalesTransactionRecord;
        const saleDocRef = doc(db, 'stations', item.stationId, 'sales', sale.id);

        await setDoc(saleDocRef, {
          stationId: item.stationId,
          shiftId: sale.shiftId,
          dispenserCode: sale.dispenserCode,
          nozzleCode: sale.nozzleCode,
          productName: sale.productName,
          gradeCode: sale.gradeCode,
          quantityLitres: sale.quantityLitres,
          unitSellingPrice: sale.unitSellingPrice,
          unitCostPrice: sale.unitCostPrice,
          grossProfit: sale.grossProfit,
          operatorUid: firebaseUserId || sale.operatorUid || 'offline-operator',
          operatorName: (userDisplayName || sale.operatorName || 'Attendant').slice(0, 100),
          ...(sale.customerId ? { customerId: sale.customerId } : {}),
          ...(sale.customerName ? { customerName: sale.customerName } : {}),
          receiptNumber: sale.receiptNumber,
          paymentMode: sale.paymentMode,
          ...(sale.paymentReference ? { paymentReference: sale.paymentReference } : {}),
          ...(sale.vehicleNo ? { vehicleNo: sale.vehicleNo } : {}),
          totalAmount: sale.totalAmount,
          status: 'POSTED',
          soldDate: sale.soldDate,
          soldAt: serverTimestamp(),
        });

        // If credit sale, update credit customer balance
        if (sale.paymentMode === 'CREDIT' && sale.customerId) {
          try {
            const custDocRef = doc(db, 'stations', item.stationId, 'creditCustomers', sale.customerId);
            await updateDoc(custDocRef, {
              currentBalance: sale.totalAmount, // or increment
              updatedAt: serverTimestamp(),
            });
          } catch {
            // customer balance update non-blocking if preview customer
          }
        }

        await updateOfflineSaleSyncStatus(sale.id, 'synced');
      } else if (item.action === 'CREATE_SHIFT') {
        const shift = item.payload as ShiftRecord;
        const shiftDocRef = doc(db, 'stations', item.stationId, 'shifts', shift.id);

        await setDoc(shiftDocRef, {
          stationId: item.stationId,
          shiftCode: shift.shiftCode,
          shiftType: shift.shiftType,
          businessDate: shift.businessDate,
          supervisorUid: firebaseUserId || 'manager-uid',
          operatorUid: firebaseUserId || 'operator-uid',
          status: shift.status || 'OPEN',
          openingCashFloat: shift.openingCashFloat,
          expectedCashTotal: 0,
          actualCashCollected: 0,
          cashVariance: 0,
          cashBagSealNo: shift.handover.cashBagSealNo || 'SEAL-01',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await storeOfflineShift(shift);
      } else if (item.action === 'SUBMIT_SHIFT_HANDOVER') {
        const shift = item.payload as ShiftRecord;
        const shiftDocRef = doc(db, 'stations', item.stationId, 'shifts', shift.id);

        await updateDoc(shiftDocRef, {
          status: 'HANDED_OVER',
          actualCashCollected: shift.approval.verifiedCashCount || 0,
          cashBagSealNo: shift.handover.cashBagSealNo || 'SEAL-HANDOVER',
          updatedAt: serverTimestamp(),
        });

        await storeOfflineShift(shift);
      } else if (item.action === 'APPROVE_SHIFT') {
        const shift = item.payload as ShiftRecord;
        const shiftDocRef = doc(db, 'stations', item.stationId, 'shifts', shift.id);

        await updateDoc(shiftDocRef, {
          status: 'APPROVED',
          updatedAt: serverTimestamp(),
        });

        await storeOfflineShift(shift);
      } else if (item.action === 'REJECT_SHIFT') {
        const shift = item.payload as ShiftRecord;
        const shiftDocRef = doc(db, 'stations', item.stationId, 'shifts', shift.id);

        await updateDoc(shiftDocRef, {
          status: 'REJECTED',
          updatedAt: serverTimestamp(),
        });

        await storeOfflineShift(shift);
      } else if (item.action === 'ADD_SHIFT_EXPENSE') {
        const expense = item.payload as ShiftExpense & { shiftId: string };
        const expenseDocRef = doc(
          db,
          'stations',
          item.stationId,
          'shifts',
          expense.shiftId,
          'expenses',
          expense.id
        );

        await setDoc(expenseDocRef, {
          shiftId: expense.shiftId,
          stationId: item.stationId,
          category: expense.category,
          vendor: expense.vendor,
          amount: expense.amount,
          paidFromCashDrawer: expense.paidFromCashDrawer,
          receiptRef: expense.receiptRef,
          recordedByUid: firebaseUserId || 'operator-uid',
          createdAt: serverTimestamp(),
        });
      }

      // Successfully synced: Remove from outbox
      await removeOutboxItem(item.id);
      result.synced += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Sync] Failed item ${item.id}:`, msg);
      item.status = 'failed';
      item.retryCount += 1;
      item.errorMessage = msg;
      await updateOutboxItem(item);
      result.failed += 1;
      result.errors.push(`${item.action} (${item.id}): ${msg}`);
    }
  }

  await setOfflineMetadata('lastSyncAt', Date.now());

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('petrolops-sync-completed', {
        detail: result,
      })
    );
  }

  return result;
}
