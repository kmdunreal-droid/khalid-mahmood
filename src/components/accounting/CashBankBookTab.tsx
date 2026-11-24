import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  Search,
  Wallet,
} from 'lucide-react';
import {
  AccountingBookType,
  AccountingEntryCategory,
  AccountingPaymentMode,
  AccountingTransactionRecord,
  CashFlowDirection,
} from '../../data/accountingTypes';
import { computeBookLedger } from '../../utils/accountingMath';
import { formatCurrency } from '../../utils/shiftMath';

interface CashBankBookTabProps {
  bookMode: 'CASH' | 'BANK';
  transactions: AccountingTransactionRecord[];
  onAddTransaction: (payload: {
    bookType: AccountingBookType;
    entryCategory: AccountingEntryCategory;
    direction: CashFlowDirection;
    txDate: string;
    voucherNo: string;
    accountName: string;
    partyOrVendor: string;
    paymentMode: AccountingPaymentMode;
    amount: number;
    referenceNo: string;
    description?: string;
  }) => Promise<void>;
}

export const CashBankBookTab: React.FC<CashBankBookTabProps> = ({
  bookMode,
  transactions,
  onAddTransaction,
}) => {
  const isCash = bookMode === 'CASH';
  const ledger = useMemo(
    () => computeBookLedger(transactions, bookMode),
    [transactions, bookMode]
  );

  const [entryKind, setEntryKind] = useState<'RECEIPT' | 'PAYMENT' | 'CONTRA'>('RECEIPT');
  const [partyOrVendor, setPartyOrVendor] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<AccountingPaymentMode>(
    isCash ? 'CASH' : 'UPI'
  );
  const [amount, setAmount] = useState<string>('12500');
  const [txDate, setTxDate] = useState<string>('2026-11-23');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ledger.rows;
    return ledger.rows.filter(
      ({ tx }) =>
        tx.voucherNo.toLowerCase().includes(q) ||
        tx.partyOrVendor.toLowerCase().includes(q) ||
        tx.referenceNo.toLowerCase().includes(q) ||
        tx.entryCategory.toLowerCase().includes(q)
    );
  }, [ledger.rows, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setFeedback({ kind: 'err', text: 'Amount must be greater than Rs. 0.00.' });
      return;
    }

    if (
      (entryKind === 'PAYMENT' || (entryKind === 'CONTRA' && isCash)) &&
      amt > ledger.closingBalance
    ) {
      setFeedback({
        kind: 'err',
        text: `Insufficient ${isCash ? 'Cash Chest' : 'Bank Account'} balance (${formatCurrency(
          ledger.closingBalance
        )} available).`,
      });
      return;
    }

    const party =
      partyOrVendor.trim() ||
      (entryKind === 'CONTRA'
        ? isCash
          ? 'Cash-to-Bank Deposit (HBL #4819)'
          : 'Bank-to-Cash Chest Withdrawal'
        : isCash
        ? 'Forecourt Counter Cash'
        : 'HBL Current A/c #4819');

    const ref = referenceNo.trim() || `${isCash ? 'CSH' : 'BNK'}-${Date.now().toString().slice(-5)}`;
    const voucherNo = `${entryKind === 'CONTRA' ? 'CNT' : isCash ? 'CSH' : 'BNK'}-${Date.now()
      .toString()
      .slice(-5)}`;

    const resolvedBookType: AccountingBookType =
      entryKind === 'CONTRA' ? 'CONTRA' : bookMode;
    const resolvedCategory: AccountingEntryCategory =
      entryKind === 'CONTRA'
        ? isCash
          ? 'BANK_DEPOSIT'
          : 'CASH_WITHDRAWAL'
        : entryKind === 'RECEIPT'
        ? 'FUEL_SALES_RECEIPT'
        : 'SUPPLIER_PAYMENT';
    const resolvedDirection: CashFlowDirection =
      entryKind === 'RECEIPT' ? 'INFLOW' : 'OUTFLOW';

    setSubmitting(true);
    try {
      await onAddTransaction({
        bookType: resolvedBookType,
        entryCategory: resolvedCategory,
        direction: resolvedDirection,
        txDate,
        voucherNo,
        accountName:
          entryKind === 'CONTRA'
            ? 'Station Cash Chest <-> HBL Current #4819'
            : isCash
            ? 'Station Cash Chest'
            : 'HBL Current A/c #4819',
        partyOrVendor: party,
        paymentMode: entryKind === 'CONTRA' ? 'CONTRA' : isCash ? 'CASH' : paymentMode,
        amount: +amt.toFixed(2),
        referenceNo: ref,
        description: description.trim() || undefined,
      });
      setPartyOrVendor('');
      setReferenceNo('');
      setDescription('');
      setFeedback({
        kind: 'ok',
        text: `Voucher ${voucherNo} posted to ${isCash ? 'Cash Book' : 'Bank Book'} (${formatCurrency(
          amt
        )}).`,
      });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Unable to post ledger voucher.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    const header = 'Date,Voucher,Account,Party,Category,Mode,Receipt,Payment,Balance,Reference';
    const lines = ledger.rows.map(({ tx, effect, runningBalance }) =>
      [
        tx.txDate,
        tx.voucherNo,
        `"${tx.accountName}"`,
        `"${tx.partyOrVendor}"`,
        tx.entryCategory,
        tx.paymentMode,
        effect === 'RECEIPT' ? tx.amount.toFixed(2) : '0.00',
        effect === 'PAYMENT' ? tx.amount.toFixed(2) : '0.00',
        runningBalance.toFixed(2),
        tx.referenceNo,
      ].join(',')
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isCash ? 'station_cash_book.csv' : 'station_bank_book.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Book Balance Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isCash ? 'Opening Cash Chest' : 'Opening Bank Balance'}
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {formatCurrency(ledger.openingBalance)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Brought forward</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Receipts (Debit +)</div>
          <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
            {formatCurrency(ledger.totalReceipts)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Sales, collections & transfers in
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Payments (Credit -)</div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {formatCurrency(ledger.totalPayments)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Expenses, supplier & contra outflows
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isCash ? 'Closing Cash in Hand' : 'Closing Bank Balance'}
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            {formatCurrency(ledger.closingBalance)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {isCash ? 'Station Cash Chest' : 'HBL Current #4819'}
          </div>
        </div>
      </div>

      {/* Post Cash / Bank / Contra Entry Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {isCash ? (
              <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            )}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {isCash ? 'Post Cash Book Voucher' : 'Post Bank Book Voucher'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isCash
                  ? 'Record physical cash receipts, counter disbursements, or bank vault deposits (contra).'
                  : 'Record Online/Card settlements, IBFT/RTGS transfers, or cash chest withdrawals (contra).'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            {(
              [
                { id: 'RECEIPT', label: 'Receipt (+)' },
                { id: 'PAYMENT', label: 'Payment (-)' },
                {
                  id: 'CONTRA',
                  label: isCash ? 'Deposit to Bank' : 'Withdraw Cash',
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setEntryKind(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  entryKind === opt.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Party / Particulars
              </label>
              <input
                type="text"
                value={partyOrVendor}
                onChange={(e) => setPartyOrVendor(e.target.value)}
                placeholder={
                  entryKind === 'CONTRA'
                    ? isCash
                      ? 'Cash Deposit to HBL #4819'
                      : 'Bank Cash Chest Top-up'
                    : isCash
                    ? 'Evening Shift Cash Remittance'
                    : 'Bank Settlement / Party Name'
                }
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
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Payment Mode
              </label>
              {entryKind === 'CONTRA' ? (
                <div className="px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  CONTRA
                </div>
              ) : isCash ? (
                <div className="px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300">
                  CASH
                </div>
              ) : (
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as AccountingPaymentMode)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="UPI">Online / QR Settlement</option>
                  <option value="CARD">Card POS Batch</option>
                  <option value="NEFT">Bank Transfer (IBFT)</option>
                  <option value="RTGS">RTGS / Wire</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              )}
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

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Ref / Slip No.
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="Ref / Slip No."
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional narration / audit remarks..."
              className="flex-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {submitting ? 'Posting...' : `Post ${isCash ? 'Cash Book' : 'Bank Book'} Entry`}
            </button>
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

      {/* Book Ledger Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              {isCash ? 'Cash Book Register' : 'Bank Book Register (HBL #4819)'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chronological receipts, payments, and contra transfers with running balance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search voucher, party, ref..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4 font-semibold">Date · Voucher</th>
                <th className="py-2.5 px-4 font-semibold">Particulars / Party</th>
                <th className="py-2.5 px-4 font-semibold">Mode · Ref</th>
                <th className="py-2.5 px-4 font-semibold text-right">Receipt (Dr +)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Payment (Cr -)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Balance</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 px-4 text-center text-slate-500 dark:text-slate-400">
                    No {isCash ? 'Cash Book' : 'Bank Book'} vouchers match your filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map(({ tx, effect, runningBalance }) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                        {tx.txDate}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {tx.voucherNo}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {tx.partyOrVendor}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {tx.entryCategory.replace(/_/g, ' ')}
                        {tx.description ? ` · ${tx.description}` : ''}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                      <div>{tx.paymentMode === 'UPI' ? 'ONLINE / QR' : tx.paymentMode}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {tx.referenceNo}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                      {effect === 'RECEIPT' ? formatCurrency(tx.amount) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {effect === 'PAYMENT' ? formatCurrency(tx.amount) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                      {formatCurrency(runningBalance)}
                    </td>
                    <td className="py-2.5 px-4">
                      {tx.approvalStatus === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approved
                        </span>
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
