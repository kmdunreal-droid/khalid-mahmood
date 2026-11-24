import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CreditCard, Plus, X } from 'lucide-react';
import {
  SupplierInvoiceRecord,
  SupplierPaymentMode,
  SupplierPaymentRecord,
} from '../../data/purchaseTypes';
import { formatCurrency } from '../../utils/shiftMath';

interface PaymentsTabProps {
  invoices: SupplierInvoiceRecord[];
  payments: SupplierPaymentRecord[];
  preselectedInvoice: SupplierInvoiceRecord | null;
  onClearPreselectedInvoice: () => void;
  onRecordPayment: (
    payment: Omit<SupplierPaymentRecord, 'id' | 'stationId' | 'recordedByUid'>
  ) => Promise<void> | void;
}

export const PaymentsTab: React.FC<PaymentsTabProps> = ({
  invoices,
  payments,
  preselectedInvoice,
  onClearPreselectedInvoice,
  onRecordPayment,
}) => {
  const openInvoices = useMemo(
    () => invoices.filter((inv) => inv.paymentStatus !== 'PAID' && inv.totalAmount > inv.paidAmount),
    [invoices]
  );

  const [showForm, setShowForm] = useState<boolean>(Boolean(preselectedInvoice));
  const [invoiceId, setInvoiceId] = useState<string>(
    preselectedInvoice?.id ?? openInvoices[0]?.id ?? ''
  );
  const [paymentMode, setPaymentMode] = useState<SupplierPaymentMode>('RTGS');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const selectedInvoice = useMemo(
    () => openInvoices.find((i) => i.id === invoiceId) ?? openInvoices[0] ?? null,
    [openInvoices, invoiceId]
  );

  const remainingBalance = selectedInvoice
    ? +(selectedInvoice.totalAmount - selectedInvoice.paidAmount).toFixed(2)
    : 0;

  useEffect(() => {
    if (preselectedInvoice) {
      setShowForm(true);
      setInvoiceId(preselectedInvoice.id);
      const bal = +(preselectedInvoice.totalAmount - preselectedInvoice.paidAmount).toFixed(2);
      setAmount(String(bal));
    }
  }, [preselectedInvoice]);

  useEffect(() => {
    if (!invoiceId && openInvoices.length > 0) {
      setInvoiceId(openInvoices[0].id);
    }
  }, [invoiceId, openInvoices]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedInvoice) {
      setFormError('No open supplier invoice selected for settlement.');
      return;
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('Payment amount must be greater than zero.');
      return;
    }
    if (parsedAmount > remainingBalance + 0.01) {
      setFormError(
        `Payment amount exceeds remaining invoice balance (${formatCurrency(remainingBalance)}).`
      );
      return;
    }
    if (paymentRef.trim().length < 2) {
      setFormError('Enter a valid UTR / RTGS / Cheque / UPI reference number.');
      return;
    }

    setSaving(true);
    try {
      await onRecordPayment({
        supplierId: selectedInvoice.supplierId,
        supplierName: selectedInvoice.supplierName,
        invoiceId: selectedInvoice.id,
        invoiceNumber: selectedInvoice.invoiceNumber,
        paymentRef: paymentRef.trim().slice(0, 48),
        paymentDate,
        paymentMode,
        amount: +parsedAmount.toFixed(2),
        notes: notes.trim().slice(0, 300),
      });
      setShowForm(false);
      onClearPreselectedInvoice();
      setPaymentRef('');
      setAmount('');
      setNotes('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to post supplier payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-slate-600 dark:text-slate-400">
          Post RTGS, NEFT, Cheque, or Online settlements against open supplier invoices.
        </div>
        <button
          type="button"
          disabled={openInvoices.length === 0}
          onClick={() => {
            setFormError(null);
            if (!amount && selectedInvoice) {
              setAmount(String(remainingBalance));
            }
            setShowForm((v) => !v);
          }}
          className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Post Supplier Payment</span>
        </button>
      </div>

      {showForm && selectedInvoice && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Settle Supplier Invoice</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                onClearPreselectedInvoice();
              }}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Target Open Invoice
              </label>
              <select
                value={selectedInvoice.id}
                onChange={(e) => {
                  const id = e.target.value;
                  setInvoiceId(id);
                  const inv = openInvoices.find((i) => i.id === id);
                  if (inv) {
                    setAmount(String(+(inv.totalAmount - inv.paidAmount).toFixed(2)));
                  }
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {openInvoices.map((inv) => {
                  const bal = +(inv.totalAmount - inv.paidAmount).toFixed(2);
                  return (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} · {inv.supplierName} (Due: {formatCurrency(bal)})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Payment Mode
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as SupplierPaymentMode)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="RTGS">RTGS Bank Transfer</option>
                <option value="NEFT">NEFT Transfer</option>
                <option value="CHEQUE">Cheque Clearing</option>
                <option value="UPI">Corporate Online</option>
                <option value="CASH">Cash Counter</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Payment Date
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Reference Number
              </label>
              <input
                type="text"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                maxLength={48}
                required
                placeholder="RTGS-HBL-9921840"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-lg"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  Amount (Rs.)
                </label>
                <button
                  type="button"
                  onClick={() => setAmount(String(remainingBalance))}
                  className="text-[11px] text-blue-700 dark:text-blue-400 hover:underline"
                >
                  Full ({formatCurrency(remainingBalance)})
                </button>
              </div>
              <input
                type="number"
                min={0.01}
                max={remainingBalance}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Settlement Remarks
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={300}
                placeholder="e.g., Paid via Current A/c #4810"
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                onClearPreselectedInvoice();
              }}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Posting Payment...' : 'Confirm & Record Payment'}
            </button>
          </div>
        </form>
      )}

      {/* Payment History Ledger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Payment Date</th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Invoice Settled</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Remarks</th>
                <th className="py-3 px-4 text-right">Amount Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {p.paymentDate}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                    {p.paymentRef}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{p.supplierName}</td>
                  <td className="py-3 px-4 font-mono text-blue-700 dark:text-blue-400">{p.invoiceNumber}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{p.paymentMode === 'UPI' ? 'ONLINE' : p.paymentMode}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                    {p.notes || 'Standard vendor remittance'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(p.amount)}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No supplier payments recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
