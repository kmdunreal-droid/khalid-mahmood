import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useOfflineSync } from '../../context/OfflineSyncContext';
import { OutboxMutation } from '../../services/offlineStorage';

interface OfflineQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatMutationTitle(item: OutboxMutation): string {
  switch (item.action) {
    case 'CREATE_SALE': {
      const payload = item.payload || {};
      const litres = payload.quantityLitres ?? 0;
      const amount = payload.totalAmount ?? 0;
      const receipt = payload.receiptNumber || 'POS';
      return `Fuel Sale ${receipt} (${litres} L · Rs. ${amount.toLocaleString('en-PK')})`;
    }
    case 'CREATE_SHIFT': {
      const payload = item.payload || {};
      return `New Shift: ${payload.shiftCode || payload.id}`;
    }
    case 'SUBMIT_SHIFT_HANDOVER': {
      const payload = item.payload || {};
      return `Shift Handover: ${payload.shiftCode || 'Shift'} (Seal ${payload.handover?.cashBagSealNo || 'N/A'})`;
    }
    case 'APPROVE_SHIFT': {
      const payload = item.payload || {};
      return `Manager Approval: ${payload.shiftCode || 'Shift'}`;
    }
    case 'REJECT_SHIFT': {
      const payload = item.payload || {};
      return `Manager Rejection: ${payload.shiftCode || 'Shift'}`;
    }
    case 'ADD_SHIFT_EXPENSE': {
      const payload = item.payload || {};
      return `Shift Expense: ${payload.category} (Rs. ${(payload.amount || 0).toLocaleString('en-PK')})`;
    }
    default:
      return `${item.module.toUpperCase()} — ${item.action}`;
  }
}

export const OfflineQueueModal: React.FC<OfflineQueueModalProps> = ({ isOpen, onClose }) => {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncedAt,
    outboxItems,
    syncNow,
    clearSyncedItems,
  } = useOfflineSync();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Offline Storage & Sync
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                IndexedDB local transactions & cloud sync queue
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Strip */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                <Wifi className="w-4 h-4" />
                Network Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                <WifiOff className="w-4 h-4" />
                Offline (Working locally)
              </span>
            )}
          </div>
          <div className="text-slate-500 dark:text-slate-400">
            {lastSyncedAt ? (
              <span>Last synced: {lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            ) : (
              <span>Not synced yet this session</span>
            )}
          </div>
        </div>

        {/* Queue Items List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Outbox Queue ({outboxItems.length} total · {pendingCount} pending)
            </span>
            {outboxItems.some((i) => i.status === 'synced') && (
              <button
                onClick={() => clearSyncedItems()}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Synced
              </button>
            )}
          </div>

          {outboxItems.length === 0 ? (
            <div className="py-8 text-center text-slate-400 dark:text-slate-500">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/80 mb-2" />
              <p className="text-sm font-medium">All local operations are synchronized</p>
              <p className="text-xs mt-1">
                Any sales or shift operations logged while offline will appear here and sync automatically.
              </p>
            </div>
          ) : (
            outboxItems.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 flex items-start justify-between gap-3 shadow-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                        item.module === 'sales'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                      }`}
                    >
                      {item.module}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(item.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                  <h4 className="mt-1 text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {formatMutationTitle(item)}
                  </h4>
                  {item.errorMessage && (
                    <p className="mt-1 text-[11px] text-red-500 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {item.errorMessage}
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  {item.status === 'syncing' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Syncing
                    </span>
                  ) : item.status === 'synced' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <CheckCircle2 className="w-3 h-3" />
                      Synced
                    </span>
                  ) : item.status === 'failed' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                      <AlertCircle className="w-3 h-3" />
                      Retry {item.retryCount}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                      <Clock className="w-3 h-3" />
                      Pending
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/70 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {isOnline
              ? 'Automatic sync triggers immediately when network is active.'
              : 'Local changes will sync automatically once device reconnects.'}
          </p>
          <button
            onClick={() => syncNow()}
            disabled={isSyncing || pendingCount === 0 || !isOnline}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:pointer-events-none transition shadow-sm active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
