import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Users,
} from 'lucide-react';
import {
  AccountingPaymentMode,
  CreditLedgerEntryRecord,
} from '../../data/accountingTypes';
import { CreditCustomerAccount } from '../../data/salesTypes';
import { formatCurrency } from '../../utils/shiftMath';

interface CustomerLedgerTabProps {
  customers: CreditCustomerAccount[];
  ledgerEntries: CreditLedgerEntryRecord[];
  onRecordCustomerRepayment: (payload: {
    customerId: string;
    amount: number;
    paymentMode: AccountingPaymentMode;
    referenceId: string;
    txDate: string;
    notes: string;
  }) => Promise<void>;
}

export const CustomerLedgerTab: React.FC<CustomerLedgerTabProps> = ({
  customers,
  ledgerEntries,
  onRecordCustomerRepayment,
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    customers[0]?.id ?? ''
  );
  const [repaymentAmount, setRepaymentAmount] = useState<string>('25000');
  const [paymentMode, setPaymentMode] = useState<AccountingPaymentMode>('NEFT');
  const [referenceId, setReferenceId] = useState<string>('');
  const [txDate, setTxDate] = useState<string>('2026-11-23');
  const [notes, setNotes] = useState<string>('Fleet statement settlement');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? customers[0],
    [customers, selectedCustomerId]
  );

  const customerStatement = useMemo(() => {
    if (!selectedCustomer) return [];
    return ledgerEntries
      .filter((e) => e.customerId === selectedCustomer.id)
      .slice()
      .sort((a, b) => b.txDate.localeCompare(a.txDate));
  }, [ledgerEntries, selectedCustomer]);

  const totalReceivable = customers.reduce((s, c) => s + c.currentBalance, 0);
  const totalLimit = customers.reduce((s, c) => s + c.creditLimit, 0);
  const holdCount = customers.filter((c) => c.status !== 'ACTIVE').length;

  const handleSubmitRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setFeedback(null);

    const amt = Number(repaymentAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setFeedback({ kind: 'err', text: 'Repayment amount must be greater than Rs. 0.00.' });
      return;
    }
    if (amt > selectedCustomer.currentBalance) {
      setFeedback({
        kind: 'err',
        text: `Repayment exceeds outstanding receivable (${formatCurrency(
          selectedCustomer.currentBalance
        )}).`,
      });
      return;
    }

    const ref = referenceId.trim() || `RCP-${Date.now().toString().slice(-6)}`;
    setSubmitting(true);
    try {
      await onRecordCustomerRepayment({
        customerId: selectedCustomer.id,
        amount: +amt.toFixed(2),
        paymentMode,
        referenceId: ref,
        txDate,
        notes: notes.trim() || 'Fleet customer credit repayment',
      });
      setReferenceId('');
      setFeedback({
        kind: 'ok',
        text: `Recorded ${formatCurrency(amt)} settlement for ${selectedCustomer.companyName} and posted to ${
          paymentMode === 'CASH' ? 'Cash Book' : 'Bank Book'
        }.`,
      });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Unable to post customer repayment.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Receivable Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Total Fleet Receivable (Debtors)
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {formatCurrency(totalReceivable)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Across {customers.length} corporate credit accounts
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Sanctioned Credit Exposure</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {formatCurrency(totalLimit)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
            {totalLimit > 0 ? ((totalReceivable / totalLimit) * 100).toFixed(1) : '0.0'}% utilized
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Accounts on Soft Hold</div>
          <div
            className={`text-xl font-bold font-mono tabular-nums mt-1 ${
              holdCount > 0
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {holdCount} accounts
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Auto-releases below 90% limit on repayment
          </div>
        </div>
      </div>

      {/* Customer Directory Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Corporate Fleet Customer Accounts
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Select an account to inspect ledger or post receipt
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4 font-semibold">Code · Company</th>
                <th className="py-2.5 px-4 font-semibold text-right">Credit Limit</th>
                <th className="py-2.5 px-4 font-semibold text-right">Receivable Balance</th>
                <th className="py-2.5 px-4 font-semibold text-right">Available Headroom</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="py-2.5 px-4 font-semibold text-right">Select</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {customers.map((cust) => {
                const available = Math.max(0, cust.creditLimit - cust.currentBalance);
                const utilPct =
                  cust.creditLimit > 0
                    ? Math.round((cust.currentBalance / cust.creditLimit) * 100)
                    : 0;
                const isSelected = selectedCustomer?.id === cust.id;
                return (
                  <tr
                    key={cust.id}
                    className={
                      isSelected
                        ? 'bg-blue-50/50 dark:bg-blue-950/30'
                        : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                    }
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {cust.companyName}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {cust.accountCode} · {cust.whitelistedVehicles.length} vehicles
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(cust.creditLimit)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                      {formatCurrency(cust.currentBalance)}
                      <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                        {utilPct}% used
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(available)}
                    </td>
                    <td className="py-3 px-4">
                      {cust.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {cust.status}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedCustomerId(cust.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isSelected ? 'Viewing' : 'View Ledger'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Repayment + Selected Customer Statement */}
      {selectedCustomer && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Record Customer Repayment
              </h4>
            </div>
            <form onSubmit={handleSubmitRepayment} className="pt-4 space-y-3">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Selected Fleet Account</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {selectedCustomer.companyName}
                </div>
                <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 mt-0.5">
                  Due: {formatCurrency(selectedCustomer.currentBalance)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Repayment Amount (Rs.)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={repaymentAmount}
                  onChange={(e) => setRepaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Deposit Book / Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as AccountingPaymentMode)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="NEFT">Bank Transfer (IBFT)</option>
                    <option value="RTGS">RTGS (Bank Book)</option>
                    <option value="UPI">Online / QR (Bank Book)</option>
                    <option value="CHEQUE">Cheque (Bank Book)</option>
                    <option value="CASH">Cash (Cash Book)</option>
                  </select>
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

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Receipt / Bank Reference
                </label>
                <input
                  type="text"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  placeholder="IBFT-REF-001"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || selectedCustomer.currentBalance <= 0}
                className="w-full py-2.5 px-4 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {submitting ? 'Posting Receipt...' : 'Post Repayment & Update Cash/Bank'}
              </button>

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

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Statement of Account · {selectedCustomer.companyName}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Account {selectedCustomer.accountCode}
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                Closing Due: {formatCurrency(selectedCustomer.currentBalance)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4 font-semibold">Date</th>
                    <th className="py-2.5 px-4 font-semibold">Entry Type</th>
                    <th className="py-2.5 px-4 font-semibold">Reference</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Debit (Billed)</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Credit (Paid)</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Running Bal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {customerStatement.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 px-4 text-center text-slate-500 dark:text-slate-400">
                        No subledger transactions recorded for this customer yet.
                      </td>
                    </tr>
                  ) : (
                    customerStatement.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {entry.txDate}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {entry.txType.replace(/_/g, ' ')}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {entry.notes}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                          {entry.referenceId}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                          {entry.txType === 'INVOICE_DEBIT' ? formatCurrency(entry.amount) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                          {entry.txType === 'PAYMENT_CREDIT' ? formatCurrency(entry.amount) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                          {formatCurrency(entry.runningBalance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
