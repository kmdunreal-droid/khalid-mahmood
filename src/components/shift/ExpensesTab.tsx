import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  ActiveRolePersona,
  ExpenseCategory,
  ShiftExpense,
  ShiftWorkflowStatus,
} from '../../data/shiftTypes';
import { formatCurrency } from '../../utils/shiftMath';

interface ExpensesTabProps {
  expenses: ShiftExpense[];
  shiftStatus: ShiftWorkflowStatus;
  rolePersona: ActiveRolePersona;
  expenseAlertLimit: number;
  onAddExpense: (expense: Omit<ShiftExpense, 'id' | 'recordedAt'>) => void;
  onDeleteExpense: (expenseId: string) => void;
}

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'GENERATOR_FUEL', label: 'Generator Fuel (DG)' },
  { value: 'MAINTENANCE', label: 'Pump / Nozzle Maintenance' },
  { value: 'UTILITIES', label: 'Electricity / Water Utilities' },
  { value: 'STAFF_WELFARE', label: 'Staff Welfare / Refreshments' },
  { value: 'CLEANING', label: 'Forecourt Cleaning' },
];

export const ExpensesTab: React.FC<ExpensesTabProps> = ({
  expenses,
  shiftStatus,
  rolePersona,
  expenseAlertLimit,
  onAddExpense,
  onDeleteExpense,
}) => {
  const [category, setCategory] = useState<ExpenseCategory>('MAINTENANCE');
  const [vendor, setVendor] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [receiptRef, setReceiptRef] = useState<string>('');
  const [paidFromCashDrawer, setPaidFromCashDrawer] = useState<boolean>(true);

  const isLocked = shiftStatus === 'APPROVED';
  const canEdit = !isLocked && (shiftStatus === 'OPEN' || rolePersona !== 'OPERATOR');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (!vendor.trim() || !numericAmount || numericAmount <= 0) return;

    onAddExpense({
      category,
      vendor: vendor.trim(),
      description: description.trim() || 'Shift forecourt operating expense',
      amount: +numericAmount.toFixed(2),
      paidFromCashDrawer,
      receiptRef: receiptRef.trim() || `VCH-${Date.now().toString().slice(-4)}`,
      recordedBy:
        rolePersona === 'OWNER'
          ? 'Station Owner'
          : rolePersona === 'MANAGER'
          ? 'Rajesh Sharma'
          : 'Vikram Nair',
    });

    setVendor('');
    setDescription('');
    setAmount('');
    setReceiptRef('');
  };

  const cashDrawerTotal = expenses
    .filter((e) => e.paidFromCashDrawer)
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Add Expense Form */}
      <form
        onSubmit={handleSubmit}
        className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4"
      >
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Record Shift Expense</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cash drawer expenses reduce Expected Cash. Entries above{' '}
            <span className="font-mono">{formatCurrency(expenseAlertLimit)}</span> notify the Owner.
          </p>
        </div>

        <label className="block space-y-1 text-xs">
          <span className="font-medium text-slate-700 dark:text-slate-300">Expense Category</span>
          <select
            value={category}
            disabled={!canEdit}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-medium text-slate-700 dark:text-slate-300">Payee / Vendor Name</span>
          <input
            type="text"
            required
            disabled={!canEdit}
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="e.g., Gilbarco Calibration Services"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </label>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <label className="block space-y-1">
            <span className="font-medium text-slate-700 dark:text-slate-300">Amount (Rs.)</span>
            <input
              type="number"
              required
              min="1"
              step="0.01"
              disabled={!canEdit}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-medium text-slate-700 dark:text-slate-300">Voucher / Receipt</span>
            <input
              type="text"
              disabled={!canEdit}
              value={receiptRef}
              onChange={(e) => setReceiptRef(e.target.value)}
              placeholder="VCH-2026-890"
              className="w-full px-3 py-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
        </div>

        <label className="block space-y-1 text-xs">
          <span className="font-medium text-slate-700 dark:text-slate-300">Description</span>
          <textarea
            rows={2}
            disabled={!canEdit}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Purpose of expense..."
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={paidFromCashDrawer}
            onChange={(e) => setPaidFromCashDrawer(e.target.checked)}
            className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-600"
          />
          <span>Deduct directly from shift cash drawer</span>
        </label>

        <button
          type="submit"
          disabled={!canEdit}
          className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Shift Expense</span>
        </button>
      </form>

      {/* Expense Ledger Table */}
      <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Shift Expense Register
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cash-drawer deductions:{' '}
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                {formatCurrency(cashDrawerTotal)}
              </span>
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {expenses.length} entries
          </span>
        </div>

        {expenses.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            No operating expenses recorded during this shift.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs font-medium text-slate-600 dark:text-slate-400">
                  <th className="py-3 px-5">Voucher / Time</th>
                  <th className="py-3 px-4">Category & Payee</th>
                  <th className="py-3 px-4">Funding</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-5 whitespace-nowrap">
                      <div className="font-mono font-medium text-slate-900 dark:text-white">{exp.receiptRef}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {exp.recordedAt}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {exp.vendor} · <span className="text-slate-500 dark:text-slate-400">{exp.category}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{exp.description}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {exp.paidFromCashDrawer ? 'Cash Drawer' : 'Bank / Online'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatCurrency(exp.amount)}
                      {exp.amount > expenseAlertLimit && (
                        <div className="text-[10px] text-amber-700 dark:text-amber-400 font-sans font-medium">
                          Owner Alert Triggered
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => onDeleteExpense(exp.id)}
                        aria-label={`Delete expense ${exp.receiptRef}`}
                        className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
