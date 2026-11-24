import React, { useState } from 'react';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useOfflineSync } from '../../context/OfflineSyncContext';
import { OfflineQueueModal } from './OfflineQueueModal';

export const OfflineSyncStatusBadge: React.FC = () => {
  const { isOnline, isSyncing, pendingCount } = useOfflineSync();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 border ${
          !isOnline
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
            : isSyncing
            ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/20'
            : pendingCount > 0
            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20'
        }`}
        title="View Offline Cache & Outbox Sync Queue"
      >
        {!isOnline ? (
          <>
            <WifiOff className="w-3.5 h-3.5 text-amber-500" />
            <span>Offline {pendingCount > 0 ? `(${pendingCount})` : ''}</span>
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 text-sky-500 animate-spin" />
            <span>Syncing...</span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
            <span>{pendingCount} Queued</span>
          </>
        ) : (
          <>
            <Wifi className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline">Online · Synced</span>
            <span className="sm:hidden">Online</span>
          </>
        )}
      </button>

      <OfflineQueueModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
