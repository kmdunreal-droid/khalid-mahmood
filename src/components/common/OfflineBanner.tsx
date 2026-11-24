import React from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, WifiOff, X } from 'lucide-react';
import { useOfflineSync } from '../../context/OfflineSyncContext';

export const OfflineBanner: React.FC = () => {
  const { isOnline, pendingCount, syncResultNotice, clearNotice, syncNow, isSyncing } =
    useOfflineSync();

  return (
    <>
      {/* Offline Status Alert */}
      {!isOnline && (
        <div className="bg-amber-500 text-amber-950 dark:bg-amber-600 dark:text-amber-50 px-4 py-2 text-xs font-medium flex items-center justify-between gap-3 shadow-sm border-b border-amber-600/20">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              <strong>Offline Mode Active:</strong> Fuel sales and shift operations are saved locally to IndexedDB and will automatically sync once your connection returns.
              {pendingCount > 0 && ` (${pendingCount} transaction${pendingCount > 1 ? 's' : ''} stored locally)`}
            </span>
          </div>
          <span className="shrink-0 px-2 py-0.5 rounded bg-amber-600/30 text-amber-950 dark:text-amber-100 font-semibold text-[11px]">
            Device Storage
          </span>
        </div>
      )}

      {/* Sync Success / Result Toast */}
      {syncResultNotice && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-medium flex items-center justify-between gap-3 shadow-md animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
            <span>{syncResultNotice}</span>
          </div>
          <button
            onClick={clearNotice}
            className="p-1 rounded hover:bg-emerald-700 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
};
