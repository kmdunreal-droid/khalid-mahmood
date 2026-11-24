import React, { useEffect, useState } from 'react';
import { CheckCircle2, Lock, ShieldCheck, XCircle } from 'lucide-react';
import {
  ActiveRolePersona,
  ManagerApprovalInfo,
  ShiftRecord,
} from '../../data/shiftTypes';
import { formatCurrency, formatLitres, ShiftFinancialSummary } from '../../utils/shiftMath';

interface ManagerApprovalTabProps {
  shift: ShiftRecord;
  summary: ShiftFinancialSummary;
  rolePersona: ActiveRolePersona;
  varianceLimit: number;
  onApproveShift: (verifiedCash: number, auditNotes: string) => void;
  onRejectShift: (auditNotes: string) => void;
}

export const ManagerApprovalTab: React.FC<ManagerApprovalTabProps> = ({
  shift,
  summary,
  rolePersona,
  varianceLimit,
  onApproveShift,
  onRejectShift,
}) => {
  const [verifiedCashInput, setVerifiedCashInput] = useState<string>(
    String(shift.approval.verifiedCashCount ?? summary.actualCashCollected)
  );
  const [auditNotes, setAuditNotes] = useState<string>(shift.approval.auditNotes);

  useEffect(() => {
    setVerifiedCashInput(String(shift.approval.verifiedCashCount ?? summary.actualCashCollected));
    setAuditNotes(shift.approval.auditNotes);
  }, [shift.id, shift.approval.verifiedCashCount, shift.approval.auditNotes, summary.actualCashCollected]);

  const hasApprovalAuthority = rolePersona === 'MANAGER' || rolePersona === 'OWNER';
  const isReadyForReview = shift.status === 'HANDED_OVER' || shift.status === 'OPEN';
  const isApproved = shift.status === 'APPROVED';

  const parsedVerifiedCash = parseFloat(verifiedCashInput) || 0;
  const managerVariance = +(parsedVerifiedCash - summary.expectedCashInDrawer).toFixed(2);
  const exceedsTolerance = Math.abs(managerVariance) > varianceLimit;

  return (
    <div className="space-y-6">
      {/* RBAC Authority Banner if Operator is viewing */}
      {!hasApprovalAuthority && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-300">
            <Lock className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
            <span>
              Manager Approval and Shift Locking require <strong>Manager</strong> or{' '}
              <strong>Owner</strong> privileges.
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Audit Verification Table */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Shift Reconciliation Audit
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {shift.shiftCode} · Supervisor: {shift.supervisorName}
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
              {shift.status}
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="px-6 py-3 flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Total Fuel Dispensed</span>
              <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                {formatLitres(summary.totalLitresDispensed)}
              </span>
            </div>
            <div className="px-6 py-3 flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Gross Meter Sales</span>
              <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                {formatCurrency(summary.totalMeterSales)}
              </span>
            </div>
            <div className="px-6 py-3 flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Online / Card / Fleet Credit Tenders</span>
              <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                {formatCurrency(summary.nonCashTendersTotal)}
              </span>
            </div>
            <div className="px-6 py-3 flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">
                Cash Drawer Expenses ({shift.expenses.length})
              </span>
              <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                {formatCurrency(summary.cashDrawerExpensesTotal)}
              </span>
            </div>
            <div className="px-6 py-3 flex justify-between bg-slate-50 dark:bg-slate-950/60 font-semibold">
              <span className="text-slate-900 dark:text-white">Expected Cash Deposit</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(summary.expectedCashInDrawer)}
              </span>
            </div>
            <div className="px-6 py-3 flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Operator Declared Cash</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(summary.actualCashCollected)}
              </span>
            </div>
            <div className="px-6 py-3 flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Handover Bag Seal</span>
              <span className="font-mono text-slate-900 dark:text-white">{shift.handover.cashBagSealNo}</span>
            </div>
          </div>
        </div>

        {/* Manager Decision Form */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Manager Verification & Sign-Off
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Approving locks meter readings, posts the double-entry journal, and notifies the Owner.
              </p>
            </div>
            {isApproved && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Approved</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <label className="block space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Manager Verified Vault Cash (Rs.)
              </span>
              <input
                type="number"
                step="0.01"
                disabled={!hasApprovalAuthority || isApproved}
                value={verifiedCashInput}
                onChange={(e) => setVerifiedCashInput(e.target.value)}
                className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>

            <div className="space-y-1">
              <span className="block font-medium text-slate-700 dark:text-slate-300">
                Verified Cash Variance
              </span>
              <div
                className={`px-3 py-2 font-mono tabular-nums border rounded-lg font-semibold ${
                  Math.abs(managerVariance) < 0.5
                    ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                    : exceedsTolerance
                    ? 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300'
                    : 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                }`}
              >
                {managerVariance > 0 ? '+' : ''}
                {formatCurrency(managerVariance)}
              </div>
            </div>
          </div>

          <label className="block space-y-1 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">Manager Audit Notes</span>
            <textarea
              rows={3}
              disabled={!hasApprovalAuthority || isApproved}
              value={auditNotes}
              onChange={(e) => setAuditNotes(e.target.value)}
              placeholder="Document cash recount result, variance justification, or rejection reason..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>

          {exceedsTolerance && !isApproved && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg text-xs text-amber-900 dark:text-amber-300">
              Variance exceeds ±{formatCurrency(varianceLimit)} tolerance. Approving or rejecting will
              dispatch a high-priority <strong>Owner Notification</strong>.
            </div>
          )}

          {shift.approval.reviewedAt && (
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Last reviewed by {shift.approval.managerName} on {shift.approval.reviewedAt} (Decision:{' '}
              {shift.approval.decision})
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              disabled={!hasApprovalAuthority || !isReadyForReview || isApproved || summary.hasInvalidNozzleReading}
              onClick={() => onApproveShift(parsedVerifiedCash, auditNotes)}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isApproved ? 'Shift Approved & Locked' : 'Approve & Lock Shift'}</span>
            </button>

            <button
              type="button"
              disabled={!hasApprovalAuthority || isApproved || shift.status === 'REJECTED'}
              onClick={() => onRejectShift(auditNotes)}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-red-300 dark:border-red-900 bg-white dark:bg-slate-950 text-red-700 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Reject & Return to Operator</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
