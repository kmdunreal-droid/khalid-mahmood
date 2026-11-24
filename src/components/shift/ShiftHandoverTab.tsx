import React from 'react';
import { AlertTriangle, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import {
  ActiveRolePersona,
  ShiftHandoverInfo,
  ShiftWorkflowStatus,
} from '../../data/shiftTypes';
import { formatCurrency, ShiftFinancialSummary } from '../../utils/shiftMath';

interface ShiftHandoverTabProps {
  shiftCode: string;
  shiftStatus: ShiftWorkflowStatus;
  rolePersona: ActiveRolePersona;
  handover: ShiftHandoverInfo;
  summary: ShiftFinancialSummary;
  onUpdateHandover: (patch: Partial<ShiftHandoverInfo>) => void;
  onToggleChecklist: (key: keyof ShiftHandoverInfo['checklist']) => void;
  onSubmitHandover: () => void;
}

const CHECKLIST_ITEMS: { key: keyof ShiftHandoverInfo['checklist']; label: string }[] = [
  { key: 'cashCountVerified', label: 'Physical cash counted, bundled, and placed inside sealed drop bag' },
  { key: 'dipStickRecorded', label: 'Shift-end underground tank dipstick reading verified' },
  { key: 'creditSlipsBundled', label: 'Signed fleet customer credit slips tallied against POS batch' },
  { key: 'dispenserSealsIntact', label: 'All dispenser totalizer locks and nozzle seals inspected intact' },
];

export const ShiftHandoverTab: React.FC<ShiftHandoverTabProps> = ({
  shiftCode,
  shiftStatus,
  rolePersona,
  handover,
  summary,
  onUpdateHandover,
  onToggleChecklist,
  onSubmitHandover,
}) => {
  const canEdit = shiftStatus === 'OPEN' || shiftStatus === 'REJECTED';
  const allChecked = Object.values(handover.checklist).every(Boolean);
  const canSubmit =
    canEdit &&
    allChecked &&
    !summary.hasInvalidNozzleReading &&
    handover.outgoingOperator.trim().length > 0 &&
    handover.incomingOperator.trim().length > 0 &&
    handover.cashBagSealNo.trim().length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Handover Form & Checklist */}
      <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Shift Handover & Cash Bag Sealing
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Transfers custody of nozzles, cash drawer, and credit slips to the incoming shift.
            </p>
          </div>
          {handover.handedOverAt && (
            <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
              Handed over: {handover.handedOverAt}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <label className="block space-y-1">
            <span className="font-medium text-slate-700 dark:text-slate-300">Outgoing Operator</span>
            <input
              type="text"
              disabled={!canEdit}
              value={handover.outgoingOperator}
              onChange={(e) => onUpdateHandover({ outgoingOperator: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-medium text-slate-700 dark:text-slate-300">Incoming Operator</span>
            <input
              type="text"
              disabled={!canEdit}
              value={handover.incomingOperator}
              onChange={(e) => onUpdateHandover({ incomingOperator: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-medium text-slate-700 dark:text-slate-300">Cash Bag Seal No.</span>
            <input
              type="text"
              disabled={!canEdit}
              value={handover.cashBagSealNo}
              onChange={(e) => onUpdateHandover({ cashBagSealNo: e.target.value })}
              className="w-full px-3 py-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
        </div>

        <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-900 dark:text-white">
            Mandatory Handover Checklist
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {CHECKLIST_ITEMS.map((item) => {
              const checked = handover.checklist[item.key];
              return (
                <label
                  key={item.key}
                  className="flex items-center gap-3 px-4 py-3 text-xs text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                >
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={checked}
                    onChange={() => onToggleChecklist(item.key)}
                    className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-600"
                  />
                  <span>{item.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <label className="block space-y-1 text-xs">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Handover Remarks for Incoming Shift & Manager
          </span>
          <textarea
            rows={3}
            disabled={!canEdit}
            value={handover.remarks}
            onChange={(e) => onUpdateHandover({ remarks: e.target.value })}
            placeholder="Note any equipment observations, credit slip exceptions, or cash variance explanation..."
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </label>

        {summary.hasInvalidNozzleReading && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Cannot submit handover: one or more nozzle closing readings are lower than opening readings.
            </span>
          </div>
        )}

        <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Shift {shiftCode}
          </span>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onSubmitHandover}
            className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>
              {shiftStatus === 'HANDED_OVER'
                ? 'Handover Submitted (Awaiting Manager)'
                : shiftStatus === 'APPROVED'
                ? 'Shift Approved & Locked'
                : 'Submit Shift Handover'}
            </span>
          </button>
        </div>
      </div>

      {/* Handover Summary Card */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Handover Custody Summary</h3>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
            {shiftStatus === 'HANDED_OVER' || shiftStatus === 'APPROVED' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Submitted</span>
              </>
            ) : (
              <span>Draft</span>
            )}
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          <div className="px-6 py-3 flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Shift Code</span>
            <span className="font-mono font-medium text-slate-900 dark:text-white">{shiftCode}</span>
          </div>
          <div className="px-6 py-3 flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Gross Meter Sales</span>
            <span className="font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(summary.totalMeterSales)}
            </span>
          </div>
          <div className="px-6 py-3 flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Digital & Credit Tenders</span>
            <span className="font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(summary.nonCashTendersTotal)}
            </span>
          </div>
          <div className="px-6 py-3 flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Cash Drawer Expenses</span>
            <span className="font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(summary.cashDrawerExpensesTotal)}
            </span>
          </div>
          <div className="px-6 py-3 flex justify-between font-semibold bg-slate-50 dark:bg-slate-950/60">
            <span className="text-slate-900 dark:text-white">Declared Cash Drop</span>
            <span className="font-mono tabular-nums text-blue-700 dark:text-blue-400">
              {formatCurrency(summary.actualCashCollected)}
            </span>
          </div>
          <div className="px-6 py-3 flex justify-between font-semibold">
            <span className="text-slate-900 dark:text-white">Cash Variance at Handover</span>
            <span
              className={`font-mono tabular-nums ${
                Math.abs(summary.cashVariance) < 0.5
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : summary.cashVariance < 0
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {summary.cashVariance > 0 ? '+' : ''}
              {formatCurrency(summary.cashVariance)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
