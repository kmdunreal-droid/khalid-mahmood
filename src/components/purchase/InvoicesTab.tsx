import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock,
  CreditCard,
  FileText,
  Plus,
  X,
} from 'lucide-react';
import {
  PurchaseOrderRecord,
  SupplierInvoiceRecord,
  SupplierInvoiceStatus,
  SupplierRecord,
} from '../../data/purchaseTypes';
import { formatCurrency } from '../../utils/shiftMath';

interface InvoicesTabProps {
  suppliers: SupplierRecord[];
  orders: PurchaseOrderRecord[];
  invoices: SupplierInvoiceRecord[];
  onCreateInvoice: (
    invoice: Omit<SupplierInvoiceRecord, 'id' | 'stationId' | 'recordedByUid' | 'paidAmount' | 'paymentStatus'>
  ) => Promise<void> | void;
  onPayInvoice: (invoice: SupplierInvoiceRecord) => void;
}

function addDays(isoDate: string, days: number): string {
  const dt = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return isoDate;
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

export const InvoicesTab: React.FC<InvoicesTabProps> = ({
  suppliers,
  orders,
  invoices,
  onCreateInvoice,
  onPayInvoice,
}) => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [filter, setFilter] = useState<'ALL' | SupplierInvoiceStatus | 'OVERDUE'>('ALL');
  const [showForm, setShowForm] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const defaultSupplier = suppliers[0];
  const [supplierId, setSupplierId] = useState<string>(defaultSupplier?.id ?? '');
  const [poId, setPoId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(todayIso);
  const [dueDate, setDueDate] = useState<string>(
    addDays(todayIso, defaultSupplier?.paymentTermsDays ?? 7)
  );
  const [subtotalAmount, setSubtotalAmount] = useState<string>('');
  const [taxAmount, setTaxAmount] = useState<string>('0');

  const parsedSub = Number(subtotalAmount) || 0;
  const parsedTax = Number(taxAmount) || 0;
  const computedTotal = +(parsedSub + parsedTax).toFixed(2);

  const metrics = useMemo(() => {
    let billed = 0;
    let paid = 0;
    let unpaidCount = 0;
    let overdueCount = 0;
    for (const inv of invoices) {
      billed += inv.totalAmount;
      paid += inv.paidAmount;
      if (inv.paymentStatus !== 'PAID') {
        unpaidCount += 1;
        if (inv.dueDate < todayIso) overdueCount += 1;
      }
    }
    return {
      billed: +billed.toFixed(2),
      paid: +paid.toFixed(2),
      outstanding: +(billed - paid).toFixed(2),
      unpaidCount,
      overdueCount,
    };
  }, [invoices, todayIso]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (filter === 'ALL') return true;
      if (filter === 'OVERDUE') return inv.paymentStatus !== 'PAID' && inv.dueDate < todayIso;
      return inv.paymentStatus === filter;
    });
  }, [invoices, filter, todayIso]);

  const handleSupplierSelect = (id: string) => {
    setSupplierId(id);
    const sup = suppliers.find((s) => s.id === id);
    if (sup) {
      setDueDate(addDays(invoiceDate, sup.paymentTermsDays));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const sup = suppliers.find((s) => s.id === supplierId);
    if (!sup) {
      setFormError('Select a valid supplier.');
      return;
    }
    if (invoiceNumber.trim().length < 2) {
      setFormError('Supplier invoice number is required.');
      return;
    }
    if (parsedSub <= 0 || parsedTax < 0) {
      setFormError('Subtotal must be greater than zero and tax cannot be negative.');
      return;
    }

    setSaving(true);
    try {
      await onCreateInvoice({
        supplierId: sup.id,
        supplierName: sup.name,
        poId: poId || undefined,
        invoiceNumber: invoiceNumber.trim().slice(0, 48),
        invoiceDate,
        dueDate,
        subtotalAmount: parsedSub,
        taxAmount: parsedTax,
        totalAmount: computedTotal,
      });
      setShowForm(false);
      setInvoiceNumber('');
      setSubtotalAmount('');
      setTaxAmount('0');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save supplier invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Invoice Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Invoiced Value</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(metrics.billed)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {invoices.length} vendor tax invoices
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Settled to Date</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(metrics.paid)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Verified bank & online payouts</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Balance Payable</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(metrics.outstanding)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {metrics.unpaidCount} open invoice{metrics.unpaidCount === 1 ? '' : 's'}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Overdue Invoices</div>
          <div
            className={`mt-1 text-xl font-bold font-mono tabular-nums ${
              metrics.overdueCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
            }`}
          >
            {metrics.overdueCount}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {metrics.overdueCount > 0 ? 'Past credit term due date' : 'All bills within credit terms'}
          </div>
        </div>
      </div>

      {/* Filter & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-fit">
          {(['ALL', 'UNPAID', 'PARTIAL', 'PAID', 'OVERDUE'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                filter === f
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setShowForm((v) => !v);
          }}
          className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Record Supplier Invoice</span>
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Register Vendor Tax Invoice</span>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
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
                Supplier
              </label>
              <select
                value={supplierId}
                onChange={(e) => handleSupplierSelect(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (Net {s.paymentTermsDays}d)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Linked PO (Optional)
              </label>
              <select
                value={poId}
                onChange={(e) => setPoId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="">Standalone / Direct Bill</option>
                {orders
                  .filter((o) => o.supplierId === supplierId)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.poNumber}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Supplier Invoice No.
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                maxLength={48}
                required
                placeholder="PSO-INV-90455"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Invoice Date
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Taxable Subtotal (Rs.)
              </label>
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={subtotalAmount}
                onChange={(e) => setSubtotalAmount(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Tax Amount (Rs.)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Invoice Gross Total:{' '}
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                {formatCurrency(computedTotal)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Invoice'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Invoices Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Invoice No.</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Dates & Due</th>
                <th className="py-3 px-4 text-right">Subtotal + Tax</th>
                <th className="py-3 px-4 text-right">Invoice Total</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {filteredInvoices.map((inv) => {
                const balance = +(inv.totalAmount - inv.paidAmount).toFixed(2);
                const isOverdue = inv.paymentStatus !== 'PAID' && inv.dueDate < todayIso;
                return (
                  <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 align-top font-mono font-semibold text-slate-900 dark:text-white">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 align-top text-slate-800 dark:text-slate-200 font-medium">
                      {inv.supplierName}
                    </td>
                    <td className="py-3 px-4 align-top font-mono tabular-nums text-[11px]">
                      <div className="text-slate-600 dark:text-slate-400">Date: {inv.invoiceDate}</div>
                      <div className={isOverdue ? 'text-red-700 dark:text-red-400 font-semibold mt-0.5' : 'text-slate-500 dark:text-slate-400 mt-0.5'}>
                        Due: {inv.dueDate} {isOverdue ? '(Overdue)' : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 align-top text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      <div>{formatCurrency(inv.subtotalAmount)}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Tax: {formatCurrency(inv.taxAmount)}
                      </div>
                    </td>
                    <td className="py-3 px-4 align-top text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(inv.totalAmount)}
                    </td>
                    <td className="py-3 px-4 align-top text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(inv.paidAmount)}
                    </td>
                    <td className="py-3 px-4 align-top text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(balance)}
                    </td>
                    <td className="py-3 px-4 align-top">
                      {inv.paymentStatus === 'PAID' && (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Paid</span>
                        </span>
                      )}
                      {inv.paymentStatus === 'PARTIAL' && (
                        <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                          <CircleDot className="w-3.5 h-3.5" />
                          <span>Partial</span>
                        </span>
                      )}
                      {inv.paymentStatus === 'UNPAID' && (
                        <span
                          className={`inline-flex items-center gap-1.5 font-medium ${
                            isOverdue ? 'text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {isOverdue ? (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          <span>{isOverdue ? 'Overdue' : 'Unpaid'}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 align-top text-right">
                      {inv.paymentStatus !== 'PAID' ? (
                        <button
                          type="button"
                          onClick={() => onPayInvoice(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-500 whitespace-nowrap"
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>Record Payment</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Settled</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No invoices match the selected filter.
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
