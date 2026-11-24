import React, { useState } from 'react';
import { AlertTriangle, Bell, Check, CheckCircle2, Info } from 'lucide-react';
import { OwnerAlertThresholds, OwnerNotification } from '../../data/shiftTypes';
import { formatCurrency } from '../../utils/shiftMath';

interface OwnerNotificationsTabProps {
  notifications: OwnerNotification[];
  thresholds: OwnerAlertThresholds;
  onMarkRead: (notificationId: string) => void;
  onMarkAllRead: () => void;
  onInspectShift: (shiftId: string) => void;
  onUpdateThresholds: (patch: Partial<OwnerAlertThresholds>) => void;
}

export const OwnerNotificationsTab: React.FC<OwnerNotificationsTabProps> = ({
  notifications,
  thresholds,
  onMarkRead,
  onMarkAllRead,
  onInspectShift,
  onUpdateThresholds,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const filtered = notifications.filter(
    (n) => severityFilter === 'ALL' || n.severity === severityFilter
  );

  const renderSeverityLabel = (severity: OwnerNotification['severity']) => {
    if (severity === 'CRITICAL') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Critical</span>
        </span>
      );
    }
    if (severity === 'WARNING') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Warning</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400">
        <Info className="w-3.5 h-3.5" />
        <span>Info</span>
      </span>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Notification Feed */}
      <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Owner Notification Inbox
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {unreadCount} unread alerts across Day & Night shifts
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
              {(['ALL', 'CRITICAL', 'WARNING', 'INFO'] as const).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    severityFilter === sev
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {sev === 'ALL' ? 'All' : sev.charAt(0) + sev.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={unreadCount === 0}
              onClick={onMarkAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            No Owner notifications match the selected severity filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((item) => (
              <div
                key={item.id}
                className={`p-5 transition-colors ${
                  item.isRead
                    ? 'bg-white dark:bg-slate-900'
                    : 'bg-blue-50/40 dark:bg-blue-950/20'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5 text-xs">
                      {renderSeverityLabel(item.severity)}
                      <span className="text-slate-300 dark:text-slate-700">·</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">{item.shiftCode}</span>
                      <span className="text-slate-300 dark:text-slate-700">·</span>
                      <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        {item.createdAt}
                      </span>
                      {!item.isRead && (
                        <>
                          <span className="text-slate-300 dark:text-slate-700">·</span>
                          <span className="font-semibold text-blue-700 dark:text-blue-400">Unread</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{item.message}</p>
                    <div className="text-xs font-mono text-slate-700 dark:text-slate-300 pt-1">
                      {item.metricSummary}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onInspectShift(item.shiftId)}
                      className="px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                    >
                      Inspect Shift
                    </button>
                    {!item.isRead && (
                      <button
                        type="button"
                        onClick={() => onMarkRead(item.id)}
                        className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors whitespace-nowrap"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Owner Escalation Rules Panel */}
      <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Owner Alert Thresholds
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Automatically triggers alerts when shift handovers, variances, or expenses exceed limits.
          </p>
        </div>

        <label className="block space-y-1 text-xs">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Cash Variance Tolerance Limit (±Rs.)
          </span>
          <input
            type="number"
            min="0"
            step="50"
            value={thresholds.cashVarianceLimit}
            onChange={(e) =>
              onUpdateThresholds({ cashVarianceLimit: Math.max(0, parseFloat(e.target.value) || 0) })
            }
            className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <span className="block text-[11px] text-slate-500 dark:text-slate-400">
            Alert Owner if variance &gt; {formatCurrency(thresholds.cashVarianceLimit)}
          </span>
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Single Expense Alert Cap (Rs.)
          </span>
          <input
            type="number"
            min="0"
            step="100"
            value={thresholds.singleExpenseAlertLimit}
            onChange={(e) =>
              onUpdateThresholds({
                singleExpenseAlertLimit: Math.max(0, parseFloat(e.target.value) || 0),
              })
            }
            className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <span className="block text-[11px] text-slate-500 dark:text-slate-400">
            Alert Owner if any expense &gt; {formatCurrency(thresholds.singleExpenseAlertLimit)}
          </span>
        </label>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-400">
          <div className="font-semibold text-slate-900 dark:text-white">Active Trigger Hooks</div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Shift Handover Submission</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Manager Shift Approval / Rejection</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Cash Variance & High-Expense Breaches</span>
          </div>
        </div>
      </div>
    </div>
  );
};
