import React, { useMemo, useState } from 'react';
import {
  Building,
  CheckCircle2,
  ExternalLink,
  Landmark,
} from 'lucide-react';
import { AccountingPaymentMode } from '../../data/accountingTypes';
import {
  SupplierInvoiceRecord,
  SupplierPaymentRecord,
  SupplierRecord,
} from '../../data/purchaseTypes';
import { formatCurrency } from '../../utils/shiftMath';

interface SupplierLedgerTabProps {
  suppliers: SupplierRecord[];
  invoices: SupplierInvoiceRecord[];
  payments: SupplierPaymentRecord[];
  onRecordSupplierSettlement: (payload: {
    supplierId: string;
    invoiceId?: string;
    amount: number;
    paymentMode: AccountingPaymentMode;
    paymentRef: string;
    paymentDate: string;
    notes?: string;
  }) => Promise<void>;
  onNavigateToPurchase?: () => void;
}

export const SupplierLedgerTab: React.FC<SupplierLedgerTabProps> = ({
  suppliers,
  invoices,
  payments,
  onRecordSupplierSettlement,
  onNavigateToPurchase,
}) => {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    suppliers[0]?.id ?? ''
  );
  const [amount, setAmount] = useState<string>('150000');
  const [paymentMode, setPaymentMode] = useState<AccountingPaymentMode>('RTGS');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>('2026-11-23');
  const [notes, setNotes] = useState<string>('OMC vendor payable remittance');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId) ?? suppliers[0],
    [suppliers, selectedSupplierId]
  );

  const totalPayable = suppliers.reduce((s, v) => s + v.outstandingBalance, 0);
  const openInvoices = invoices.filter((i) => i.paymentStatus !== 'PAID');

  const combinedStatement = useMemo(() => {
    if (!selectedSupplier) return [];
    const supInvoices = invoices
      .filter((i) => i.supplierId === selectedSupplier.id)
      .map((i) => ({
        id: i.id,
        date: i.invoiceDate,
        kind: 'INVOICE' as const,
        ref: i.invoiceNumber,
        particulars: `Tax Invoice (Due ${i.dueDate})`,
        debitSettlement: 0,
        creditBill: i.totalAmount,
      }));
    const supPayments = payments
      .filter((p) => p.supplierId === selectedSupplier.id)
      .map((p) => ({
        id: p.id,
        date: p.paymentDate,
        kind: 'PAYMENT' as const,
        ref: p.paymentRef,
        particulars: `${p.paymentMode} Settlement (${p.invoiceNumber})`,
        debitSettlement: p.amount,
        creditBill: 0,
      }));

    const merged = [...supInvoices, ...supPayments].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    let running = 0;
    return merged
      .map((row) => {
        running = +(running + row.creditBill - row.debitSettlement).toFixed(2);
        return { ...row, runningPayable: Math.max(0, running) };
      })
      .reverse();
  }, [selectedSupplier, invoices, payments]);

  const handleSubmitSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    setFeedback(null);

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setFeedback({ kind: 'err', text: 'Settlement amount must be greater than Rs. 0.00.' });
      return;
    }
    if (amt > selectedSupplier.outstandingBalance) {
      setFeedback({
        kind: 'err',
        text: `Amount exceeds outstanding payable (${formatCurrency(
          selectedSupplier.outstandingBalance
        )}).`,
      });
      return;
    }

    const ref = paymentRef.trim() || `UTR-VND-${Date.now().toString().slice(-5)}`;
    const firstUnpaid = invoices.find(
      (i) => i.supplierId === selectedSupplier.id && i.paymentStatus !== 'PAID'
    );

    setSubmitting(true);
    try {
      await onRecordSupplierSettlement({
        supplierId: selectedSupplier.id,
        invoiceId: firstUnpaid?.id,
        amount: +amt.toFixed(2),
        paymentMode,
        paymentRef: ref,
        paymentDate,
        notes: notes.trim() || undefined,
      });
      setPaymentRef('');
      setFeedback({
        kind: 'ok',
        text: `Paid ${formatCurrency(amt)} to ${selectedSupplier.name} and logged outflow in ${
          paymentMode === 'CASH' ? 'Cash Book' : 'Bank Book'
        }.`,
      });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Unable to post supplier settlement.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Payable Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Total Supplier Payables (Creditors)
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {formatCurrency(totalPayable)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Fuel terminals & lubricant distributors
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Open Vendor Invoices</div>
          <div className="text-xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400 mt-1">
            {openInvoices.length} bills
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Unpaid or partially settled
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Total Settled Outflows</div>
            <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
              {formatCurrency(payments.reduce((s, p) => s + p.amount, 0))}
            </div>
          </div>
          {onNavigateToPurchase && (
            <button
              type="button"
              onClick={onNavigateToPurchase}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span>Purchase Bills</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Supplier Directory Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <Building className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Vendor Accounts Payable Directory
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4 font-semibold">Supplier · Tax / NTN</th>
                <th className="py-2.5 px-4 font-semibold">Category · Terms</th>
                <th className="py-2.5 px-4 font-semibold text-right">Credit Line</th>
                <th className="py-2.5 px-4 font-semibold text-right">Outstanding Payable</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="py-2.5 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {suppliers.map((sup) => {
                const isSelected = selectedSupplier?.id === sup.id;
                return (
                  <tr
                    key={sup.id}
                    className={
                      isSelected
                        ? 'bg-blue-50/50 dark:bg-blue-950/30'
                        : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                    }
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{sup.name}</div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {sup.supplierCode} · {sup.gstNumber}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      <div>{sup.category.replace(/_/g, ' ')}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Net {sup.paymentTermsDays} days
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(sup.creditLimit)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                      {formatCurrency(sup.outstandingBalance)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {sup.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedSupplierId(sup.id)}
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

      {/* Vendor Settlement Form + Statement */}
      {selectedSupplier && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <Landmark className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Post Vendor Settlement
              </h4>
            </div>
            <form onSubmit={handleSubmitSettlement} className="pt-4 space-y-3">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Selected Supplier</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {selectedSupplier.name}
                </div>
                <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 mt-0.5">
                  Payable: {formatCurrency(selectedSupplier.outstandingBalance)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Settlement Amount (Rs.)
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as AccountingPaymentMode)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="RTGS">RTGS (Bank Book)</option>
                    <option value="NEFT">Bank Transfer (IBFT)</option>
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
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Bank / Cheque Ref
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="IBFT-PSO-88912"
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
                disabled={submitting || selectedSupplier.outstandingBalance <= 0}
                className="w-full py-2.5 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {submitting ? 'Settling...' : 'Pay Vendor & Update Bank/Cash'}
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
                  Vendor Payable Statement · {selectedSupplier.name}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {selectedSupplier.supplierCode} · Tax {selectedSupplier.gstNumber}
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                Payable: {formatCurrency(selectedSupplier.outstandingBalance)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4 font-semibold">Date</th>
                    <th className="py-2.5 px-4 font-semibold">Particulars</th>
                    <th className="py-2.5 px-4 font-semibold">Reference</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Bill (Cr +)</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Paid (Dr -)</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Payable Bal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {combinedStatement.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 px-4 text-center text-slate-500 dark:text-slate-400">
                        No invoices or settlements logged for this supplier yet.
                      </td>
                    </tr>
                  ) : (
                    combinedStatement.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {row.date}
                        </td>
                        <td className="py-2.5 px-4 text-slate-900 dark:text-white font-medium">
                          {row.particulars}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                          {row.ref}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                          {row.creditBill > 0 ? formatCurrency(row.creditBill) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                          {row.debitSettlement > 0 ? formatCurrency(row.debitSettlement) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                          {formatCurrency(row.runningPayable)}
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
