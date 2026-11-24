import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Check,
  CheckCircle2,
  Edit3,
  PackagePlus,
  X,
} from 'lucide-react';
import {
  AlertSeverity,
  FuelProductStock,
  LowStockAlertItem,
  StorageTankStock,
} from '../../data/stockTypes';
import { formatLitres } from '../../utils/shiftMath';

interface LowStockAlertsTabProps {
  tanks: StorageTankStock[];
  products: FuelProductStock[];
  canMutate: boolean;
  onUpdateThreshold: (tankId: string, newThresholdLitres: number) => Promise<void>;
  onDispatchLowStockAlert: (alertItem: LowStockAlertItem) => Promise<void>;
  onNavigateToPurchase?: () => void;
}

export const LowStockAlertsTab: React.FC<LowStockAlertsTabProps> = ({
  tanks,
  products,
  canMutate,
  onUpdateThreshold,
  onDispatchLowStockAlert,
  onNavigateToPurchase,
}) => {
  const [editingTankId, setEditingTankId] = useState<string | null>(null);
  const [thresholdDraft, setThresholdDraft] = useState<string>('');
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [dispatchedIds, setDispatchedIds] = useState<Record<string, boolean>>({});
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | AlertSeverity>('ALL');

  const alertItems: LowStockAlertItem[] = useMemo(() => {
    const orderRank: Record<AlertSeverity, number> = {
      CRITICAL: 0,
      WARNING: 1,
      NOMINAL: 2,
    };

    return tanks
      .map((tank) => {
        const product = products.find((p) => p.id === tank.productId);
        const dailyBurn = product?.avgDailyOutflowLitres || 2000;
        const fillPct =
          tank.capacityLitres > 0
            ? +((tank.currentBookStockLitres / tank.capacityLitres) * 100).toFixed(1)
            : 0;
        const ullageLitres = Math.max(0, +(tank.capacityLitres - tank.currentBookStockLitres).toFixed(2));
        const shortfallLitres = Math.max(
          0,
          +(tank.minThresholdLitres - tank.currentBookStockLitres).toFixed(2)
        );

        let severity: AlertSeverity = 'NOMINAL';
        if (tank.currentBookStockLitres < tank.minThresholdLitres) {
          severity = 'CRITICAL';
        } else if (tank.currentBookStockLitres <= tank.minThresholdLitres * 1.25) {
          severity = 'WARNING';
        }

        const estimatedDaysRemaining =
          dailyBurn > 0 ? +(tank.currentBookStockLitres / dailyBurn).toFixed(1) : 0;
        const targetFill = tank.capacityLitres * 0.9;
        const recommendedOrderLitres =
          severity === 'NOMINAL'
            ? 0
            : Math.max(1000, Math.round((targetFill - tank.currentBookStockLitres) / 500) * 500);

        return {
          tank,
          product,
          severity,
          fillPct,
          ullageLitres,
          shortfallLitres,
          estimatedDaysRemaining,
          recommendedOrderLitres,
        };
      })
      .sort((a, b) => orderRank[a.severity] - orderRank[b.severity]);
  }, [tanks, products]);

  const criticalCount = alertItems.filter((a) => a.severity === 'CRITICAL').length;
  const warningCount = alertItems.filter((a) => a.severity === 'WARNING').length;
  const nominalCount = alertItems.filter((a) => a.severity === 'NOMINAL').length;

  const visibleItems = useMemo(() => {
    if (filterSeverity === 'ALL') return alertItems;
    return alertItems.filter((item) => item.severity === filterSeverity);
  }, [alertItems, filterSeverity]);

  const handleSaveThreshold = async (tankId: string) => {
    const val = Number(thresholdDraft);
    if (!Number.isFinite(val) || val < 0) return;
    await onUpdateThreshold(tankId, +val.toFixed(2));
    setEditingTankId(null);
  };

  const handleSendAlert = async (item: LowStockAlertItem) => {
    setDispatchingId(item.tank.id);
    try {
      await onDispatchLowStockAlert(item);
      setDispatchedIds((prev) => ({ ...prev, [item.tank.id]: true }));
    } finally {
      setDispatchingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Alert Summary Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400 font-semibold">
            <AlertTriangle className="w-4 h-4" />
            Critical Low Stock Breaches
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {criticalCount} tanks
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Book stock below minimum threshold
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 font-semibold">
            <AlertTriangle className="w-4 h-4" />
            Early Reorder Warnings
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {warningCount} tanks
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Within +25% buffer above min threshold
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            Healthy Inventory Buffer
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {nominalCount} tanks
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Operating safely above reorder threshold
          </div>
        </div>
      </div>

      {/* Threshold Monitoring & Alert Action Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Tank Minimum Thresholds & Replenishment Triggers
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Monitor dry-out risk, adjust tank minimum thresholds, and notify the station Owner or raise a fuel PO.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['ALL', 'CRITICAL', 'WARNING', 'NOMINAL'] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setFilterSeverity(sev)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap ${
                  filterSeverity === sev
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {sev === 'ALL' ? 'All Tanks' : sev}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Tank · Grade</th>
                <th className="py-3 px-4 font-semibold text-right">Current Book</th>
                <th className="py-3 px-4 font-semibold text-right">Min Threshold</th>
                <th className="py-3 px-4 font-semibold text-right">Runway</th>
                <th className="py-3 px-4 font-semibold text-right">Suggested Order</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleItems.map((item) => {
                const { tank, severity } = item;
                const isEditing = editingTankId === tank.id;
                const wasSent = dispatchedIds[tank.id];

                return (
                  <tr key={tank.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      {severity === 'CRITICAL' ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-red-700 dark:text-red-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          CRITICAL
                        </span>
                      ) : severity === 'WARNING' ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          WARNING
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          NOMINAL
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-slate-900 dark:text-white">
                        {tank.tankCode} · {tank.gradeCode}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {tank.productName}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {formatLitres(tank.currentBookStockLitres)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.fillPct}% capacity
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {isEditing ? (
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            step="100"
                            min="0"
                            max={tank.capacityLitres}
                            value={thresholdDraft}
                            onChange={(e) => setThresholdDraft(e.target.value)}
                            className="w-24 px-2 py-1 text-xs font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveThreshold(tank.id)}
                            className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                            title="Save minimum threshold"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTankId(null)}
                            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <span className="text-slate-800 dark:text-slate-200 font-medium">
                            {formatLitres(tank.minThresholdLitres)}
                          </span>
                          {canMutate && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTankId(tank.id);
                                setThresholdDraft(String(tank.minThresholdLitres));
                              }}
                              className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                              title="Edit minimum threshold"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      <div>{item.estimatedDaysRemaining} days</div>
                      {item.shortfallLitres > 0 && (
                        <div className="text-[11px] text-red-700 dark:text-red-400 font-semibold">
                          -{formatLitres(item.shortfallLitres)} shortfall
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {item.recommendedOrderLitres > 0
                        ? formatLitres(item.recommendedOrderLitres)
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {canMutate && severity !== 'NOMINAL' && (
                          <button
                            type="button"
                            disabled={dispatchingId === tank.id || wasSent}
                            onClick={() => handleSendAlert(item)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border ${
                              wasSent
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                                : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                            } disabled:opacity-60`}
                          >
                            <BellRing className="w-3 h-3" />
                            {wasSent
                              ? 'Alert Sent'
                              : dispatchingId === tank.id
                              ? 'Sending...'
                              : 'Notify Owner'}
                          </button>
                        )}
                        {onNavigateToPurchase && severity !== 'NOMINAL' && (
                          <button
                            type="button"
                            onClick={onNavigateToPurchase}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                          >
                            <PackagePlus className="w-3 h-3" />
                            Raise PO
                          </button>
                        )}
                        {severity === 'NOMINAL' && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            No action needed
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
