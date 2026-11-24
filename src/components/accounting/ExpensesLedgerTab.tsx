import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Receipt,
} from 'lucide-react';
import { EXPENSE_CATEGORY_LABELS } from '../../data/accountingSeedData';
import {
  AccountingPaymentMode,
  AccountingTransactionRecord,
  ExpenseCategory,
} from '../../data/accountingTypes';
import { ActiveRolePersona } from '../../data/shiftTypes';
import { formatCurrency } from '../../utils/shiftMath';

interface ExpensesLedgerTabProps {
  transactions: AccountingTransactionRecord[];
  rolePersona: ActiveRolePersona;
  onLogExpense: (payload: {
    expenseCategory: ExpenseCategory;
    bookType: 'CASH' | 'BANK';
    paymentMode: AccountingPaymentMode;
    partyOrVendor: string;
    amount: number;
    txDate: string;
    referenceNo: string;
    description?: string;
  }) => Promise<void>;
  onApproveExpense: (txId: string) => Promise<void>;
}

const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

export const ExpensesLedgerTab: React.FC<ExpensesLedgerTabProps> = ({
  transactions,
  rolePersona,
  onLogExpense,
  onApproveExpense,
}) => {
  const [expenseCategory, setExpenseCategory] =
    useState<ExpenseCategory>('MAINTENANCE');
  const [bookType, setBookType] = useState<'CASH' | 'BANK'>('CASH');
  const [paymentMode, setPaymentMode] = useState<AccountingPaymentMode>('CASH');
  const [partyOrVendor, setPartyOrVendor] = useState<string>('');
  const [amount, setAmount] = useState<string>('2400');
  const [txDate, setTxDate] = useState<string>('2026-11-23');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | ExpenseCategory>('ALL');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const expenses = useMemo(
    () =>
      transactions
        .filter((t) => t.entryCategory === 'OPERATING_EXPENSE')
        .slice()
        .sort((a, b) => b.txDate.localeCompare(a.txDate)),
    [transactions]
  );

  const filteredExpenses = useMemo(() => {
    if (categoryFilter === 'ALL') return expenses;
    return expenses.filter((e) => e.expenseCategory === categoryFilter);
  }, [expenses, categoryFilter]);

  const totalApproved = expenses
    .filter((e) => e.approvalStatus === 'APPROVED')
    .reduce((s, e) => s + e.amount, 0);
  const pendingExpenses = expenses.filter((e) => e.approvalStatus === 'PENDING_OWNER');
  const totalPending = pendingExpenses.reduce((s, e) => s + e.amount, 0);
  const cashTotal = expenses
    .filter((e) => e.bookType === 'CASH')
    .reduce((s, e) => s + e.amount, 0);
  const bankTotal = expenses
    .filter((e) => e.bookType === 'BANK')
    .reduce((s, e) => s + e.amount, 0);

  const handleBookTypeChange = (nextBook: 'CASH' | 'BANK') => {
    setBookType(nextBook);
    setPaymentMode(nextBook === 'CASH' ? 'CASH' : 'NEFT');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setFeedback({ kind: 'err', text: 'Expense amount must be greater than Rs. 0.00.' });
      return;
    }

    const vendor = partyOrVendor.trim();
    if (vendor.length < 2) {
      setFeedback({ kind: 'err', text: 'Enter the vendor, payee, or utility name.' });
      return;
    }

    const ref = referenceNo.trim() || `BILL-${Date.now().toString().slice(-5)}`;
    setSubmitting(true);
    try {
      await onLogExpense({
        expenseCategory,
        bookType,
        paymentMode,
        partyOrVendor: vendor,
        amount: +amt.toFixed(2),
        txDate,
        referenceNo: ref,
        description: description.trim() || undefined,
      });
      setPartyOrVendor('');
      setReferenceNo('');
      setDescription('');
      const willNeedOwner = rolePersona === 'MANAGER' && amt > 5000;
      setFeedback({
        kind: 'ok',
        text: willNeedOwner
          ? `Expense (${formatCurrency(amt)}) posted to ${bookType} Book as Pending Owner Approval (exceeds Rs. 5,000 petty cash limit).`
          : `Expense (${formatCurrency(amt)}) approved and posted to ${bookType} Book.`,
      });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Unable to post operating expense.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (txId: string) => {
    setApprovingId(txId);
    try {
      await onApproveExpense(txId);
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Expense Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Approved Operating Expenses</div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {formatCurrency(totalApproved)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Posted to P&L ledger
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Pending Owner Approval</div>
          <div
            className={`text-lg font-bold font-mono tabular-nums mt-1 ${
              pendingExpenses.length > 0
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {formatCurrency(totalPending)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {pendingExpenses.length} vouchers above Rs. 5,000 Manager cap
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Cash Drawer Expenses</div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {formatCurrency(cashTotal)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Disbursed via Station Cash Chest
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Bank Paid Overheads</div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {formatCurrency(bankTotal)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Paid via HBL Current #4819
          </div>
        </div>
      </div>

      {/* Log Station Operating Expense Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Log Operating Expense Voucher
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Posts directly into Cash Book or Bank Book and categorizes into the Profit & Loss schedule.
              </p>
            </div>
          </div>
          {rolePersona === 'MANAGER' && (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              Manager instant cap: Rs. 5,000 · Larger bills route for Owner approval
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Expense Category
              </label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {EXPENSE_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Vendor / Payee
              </label>
              <input
                type="text"
                value={partyOrVendor}
                onChange={(e) => setPartyOrVendor(e.target.value)}
                placeholder="e.g. WAPDA / K-Electric / Maintenance / Payroll"
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Amount (Rs.)
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Date
              </label>
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Paid From
              </label>
              <select
                value={bookType}
                onChange={(e) => handleBookTypeChange(e.target.value as 'CASH' | 'BANK')}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="CASH">Cash Chest</option>
                <option value="BANK">Bank Account (HBL)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Mode
              </label>
              <select
                value={paymentMode}
                disabled={bookType === 'CASH'}
                onChange={(e) => setPaymentMode(e.target.value as AccountingPaymentMode)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
              >
                {bookType === 'CASH' ? (
                  <option value="CASH">CASH</option>
                ) : (
                  <>
                    <option value="NEFT">Bank Transfer (IBFT)</option>
                    <option value="RTGS">RTGS</option>
                    <option value="UPI">Online / QR</option>
                    <option value="CHEQUE">Cheque</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Bill / Receipt Ref
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="BILL-2026-09"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Description (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Scope of work, invoice month..."
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 px-4 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {submitting ? 'Posting...' : 'Post Expense'}
              </button>
            </div>
          </div>

          {feedback && (
            <div
              className={`text-xs px-3 py-2 rounded-xl border ${
                feedback.kind === 'ok'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300'
              }`}
            >
              {feedback.text}
            </div>
          )}
        </form>
      </div>

      {/* Expense Register Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            Operating Expenses Ledger
          </h4>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | ExpenseCategory)}
            className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Expense Categories</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {EXPENSE_CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4 font-semibold">Date · Voucher</th>
                <th className="py-2.5 px-4 font-semibold">Category</th>
                <th className="py-2.5 px-4 font-semibold">Vendor · Notes</th>
                <th className="py-2.5 px-4 font-semibold">Source · Ref</th>
                <th className="py-2.5 px-4 font-semibold text-right">Amount</th>
                <th className="py-2.5 px-4 font-semibold">Approval</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-center text-slate-500 dark:text-slate-400">
                    No operating expenses recorded for the selected category.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                        {exp.txDate}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {exp.voucherNo}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                      {exp.expenseCategory
                        ? EXPENSE_CATEGORY_LABELS[exp.expenseCategory]
                        : 'General Expense'}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {exp.partyOrVendor}
                      </div>
                      {exp.description && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {exp.description}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                      <div>
                        {exp.bookType} · {exp.paymentMode === 'UPI' ? 'ONLINE / QR' : exp.paymentMode}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {exp.referenceNo}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="py-2.5 px-4">
                      {exp.approvalStatus === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approved
                        </span>
                      ) : rolePersona === 'OWNER' ? (
                        <button
                          type="button"
                          disabled={approvingId === exp.id}
                          onClick={() => handleApprove(exp.id)}
                          className="px-2.5 py-1 text-[11px] font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                        >
                          {approvingId === exp.id ? 'Approving...' : 'Approve Expense'}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          Pending Owner
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
