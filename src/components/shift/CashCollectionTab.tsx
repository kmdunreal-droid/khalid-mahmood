import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  ActiveRolePersona,
  CashDenominations,
  ShiftTenders,
  ShiftWorkflowStatus,
} from '../../data/shiftTypes';
import { formatCurrency, ShiftFinancialSummary } from '../../utils/shiftMath';

interface CashCollectionTabProps {
  openingCashFloat: number;
  tenders: ShiftTenders;
  summary: ShiftFinancialSummary;
  shiftStatus: ShiftWorkflowStatus;
  rolePersona: ActiveRolePersona;
  varianceLimit: number;
  onUpdateOpeningFloat: (amount: number) => void;
  onUpdateTenders: (patch: Partial<ShiftTenders>) => void;
  onUpdateDenomination: (key: keyof CashDenominations, value: number) => void;
}

const DENOM_ROWS: { key: keyof CashDenominations; label: string; multiplier: number }[] = [
  { key: 'n5000', label: 'Rs. 5,000 Notes', multiplier: 5000 },
  { key: 'n1000', label: 'Rs. 1,000 Notes', multiplier: 1000 },
  { key: 'n500', label: 'Rs. 500 Notes', multiplier: 500 },
  { key: 'n100', label: 'Rs. 100 Notes', multiplier: 100 },
  { key: 'n50', label: 'Rs. 50 Notes', multiplier: 50 },
  { key: 'n20', label: 'Rs. 20 Notes', multiplier: 20 },
  { key: 'n10', label: 'Rs. 10 Notes', multiplier: 10 },
  { key: 'coins', label: 'Coins & Loose Change (Rs.)', multiplier: 1 },
];

export const CashCollectionTab: React.FC<CashCollectionTabProps> = ({
  openingCashFloat,
  tenders,
  summary,
  shiftStatus,
  rolePersona,
  varianceLimit,
  onUpdateOpeningFloat,
  onUpdateTenders,
  onUpdateDenomination,
}) => {
  const isLocked = shiftStatus === 'APPROVED';
  const canEdit = !isLocked && (shiftStatus === 'OPEN' || rolePersona !== 'OPERATOR');

  const absVariance = Math.abs(summary.cashVariance);
  const varianceState =
    absVariance < 0.5
      ? {
          label: 'Balanced',
          color: 'text-emerald-700 dark:text-emerald-400',
          icon: <CheckCircle2 className="w-4 h-4" />,
        }
      : absVariance > varianceLimit
      ? {
          label: summary.cashVariance < 0 ? 'Critical Cash Shortage' : 'Excess Cash Alert',
          color: 'text-red-700 dark:text-red-400',
          icon: <AlertTriangle className="w-4 h-4" />,
        }
      : {
          label: summary.cashVariance < 0 ? 'Minor Shortage (Within Tolerance)' : 'Minor Excess',
          color: 'text-amber-700 dark:text-amber-400',
          icon: <AlertTriangle className="w-4 h-4" />,
        };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Physical Cash Denomination Drawer */}
      <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Physical Cash Denomination Count
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Enter PKR currency bundle counts for cash bag deposit verification.
            </p>
          </div>
          <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
            {formatCurrency(summary.actualCashCollected)}
          </span>
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs font-medium text-slate-600 dark:text-slate-400">
              <th className="py-2.5 px-6">Denomination</th>
              <th className="py-2.5 px-4 text-right">Count / Value</th>
              <th className="py-2.5 px-6 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {DENOM_ROWS.map((row) => {
              const count = tenders.denominations[row.key] ?? 0;
              const lineTotal = count * row.multiplier;
              return (
                <tr key={row.key} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-6 font-medium text-slate-800 dark:text-slate-200">{row.label}</td>
                  <td className="py-2.5 px-4 text-right">
                    <input
                      type="number"
                      min="0"
                      step={row.key === 'coins' ? '0.5' : '1'}
                      disabled={!canEdit}
                      value={count}
                      onChange={(e) =>
                        onUpdateDenomination(row.key, Math.max(0, parseFloat(e.target.value) || 0))
                      }
                      aria-label={row.label}
                      className="w-28 px-2.5 py-1.5 text-right font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </td>
                  <td className="py-2.5 px-6 text-right font-mono tabular-nums text-slate-900 dark:text-white font-medium">
                    {formatCurrency(lineTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs font-semibold text-slate-900 dark:text-white">
              <td colSpan={2} className="py-3 px-6">
                Total Physical Cash Collected
              </td>
              <td className="py-3 px-6 text-right font-mono tabular-nums text-blue-700 dark:text-blue-400">
                {formatCurrency(summary.actualCashCollected)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Digital / Credit Tenders & Reconciliation Ledger */}
      <div className="lg:col-span-6 space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Opening Float & Non-Cash Tenders
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Online/QR batches, Card POS slips, and Fleet Credit bills deducted from cash obligation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <label className="block space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Opening Cash Float (Rs.)</span>
              <input
                type="number"
                min="0"
                disabled={!canEdit || rolePersona === 'OPERATOR'}
                value={openingCashFloat}
                onChange={(e) => onUpdateOpeningFloat(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>
            <label className="block space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Online / QR Batch (Rs.)</span>
              <input
                type="number"
                min="0"
                disabled={!canEdit}
                value={tenders.upiAmount}
                onChange={(e) =>
                  onUpdateTenders({ upiAmount: Math.max(0, parseFloat(e.target.value) || 0) })
                }
                className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>
            <label className="block space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Card POS Terminal Batch (Rs.)</span>
              <input
                type="number"
                min="0"
                disabled={!canEdit}
                value={tenders.cardAmount}
                onChange={(e) =>
                  onUpdateTenders({ cardAmount: Math.max(0, parseFloat(e.target.value) || 0) })
                }
                className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>
            <label className="block space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Fleet Credit Slips Total (Rs.)</span>
              <input
                type="number"
                min="0"
                disabled={!canEdit}
                value={tenders.creditSlipAmount}
                onChange={(e) =>
                  onUpdateTenders({ creditSlipAmount: Math.max(0, parseFloat(e.target.value) || 0) })
                }
                className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>
          </div>
        </div>

        {/* Reconciliation Summary */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Shift Cash Reconciliation Statement
            </h3>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${varianceState.color}`}>
              {varianceState.icon}
              <span>{varianceState.label}</span>
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="px-6 py-2.5 flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Opening Cash Float</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                + {formatCurrency(openingCashFloat)}
              </span>
            </div>
            <div className="px-6 py-2.5 flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Gross Meter Fuel Sales</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                + {formatCurrency(summary.totalMeterSales)}
              </span>
            </div>
            <div className="px-6 py-2.5 flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Less: Online + Card + Credit Slips</span>
              <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                - {formatCurrency(summary.nonCashTendersTotal)}
              </span>
            </div>
            <div className="px-6 py-2.5 flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Less: Cash Drawer Petty Expenses</span>
              <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                - {formatCurrency(summary.cashDrawerExpensesTotal)}
              </span>
            </div>
            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950/60 flex justify-between font-semibold">
              <span className="text-slate-900 dark:text-white">Expected Cash in Drawer</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(summary.expectedCashInDrawer)}
              </span>
            </div>
            <div className="px-6 py-3 flex justify-between font-semibold">
              <span className="text-slate-900 dark:text-white">Actual Physical Cash Collected</span>
              <span className="font-mono tabular-nums text-blue-700 dark:text-blue-400">
                {formatCurrency(summary.actualCashCollected)}
              </span>
            </div>
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/60 flex justify-between font-semibold">
              <span className="text-slate-900 dark:text-white">
                Net Cash Variance (Tolerance ±{formatCurrency(varianceLimit)})
              </span>
              <span className={`font-mono tabular-nums ${varianceState.color}`}>
                {summary.cashVariance > 0 ? '+' : ''}
                {formatCurrency(summary.cashVariance)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
