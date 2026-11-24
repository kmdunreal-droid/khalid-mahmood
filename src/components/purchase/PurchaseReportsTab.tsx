import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import {
  FuelDeliveryRecord,
  PurchaseOrderRecord,
  SupplierInvoiceRecord,
  SupplierPaymentRecord,
  SupplierRecord,
} from '../../data/purchaseTypes';
import { formatCurrency, formatLitres } from '../../utils/shiftMath';

interface PurchaseReportsTabProps {
  suppliers: SupplierRecord[];
  orders: PurchaseOrderRecord[];
  deliveries: FuelDeliveryRecord[];
  invoices: SupplierInvoiceRecord[];
  payments: SupplierPaymentRecord[];
}

export const PurchaseReportsTab: React.FC<PurchaseReportsTabProps> = ({
  suppliers,
  orders,
  deliveries,
  invoices,
  payments,
}) => {
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const todayIso = new Date().toISOString().slice(0, 10);

  const supplierSpendRows = useMemo(() => {
    return suppliers
      .filter((s) => supplierFilter === 'ALL' || s.id === supplierFilter)
      .map((sup) => {
        const supOrders = orders.filter((o) => o.supplierId === sup.id && o.status !== 'CANCELLED');
        const supDeliveries = deliveries.filter((d) => d.supplierId === sup.id);
        const supInvoices = invoices.filter((i) => i.supplierId === sup.id);
        const supPayments = payments.filter((p) => p.supplierId === sup.id);

        const orderedLitres = supOrders.reduce((sum, o) => sum + o.totalOrderedLitres, 0);
        const receivedLitres = supDeliveries.reduce((sum, d) => sum + d.receivedQtyLitres, 0);
        const shortageLitres = supDeliveries.reduce((sum, d) => sum + d.shortageLitres, 0);
        const totalBilled = supInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
        const totalPaid = supPayments.reduce((sum, p) => sum + p.amount, 0);
        const unpaidBalance = Math.max(0, +(totalBilled - supInvoices.reduce((s, i) => s + i.paidAmount, 0)).toFixed(2));

        return {
          supplier: sup,
          poCount: supOrders.length,
          deliveryCount: supDeliveries.length,
          orderedLitres,
          receivedLitres,
          shortageLitres,
          totalBilled,
          totalPaid,
          unpaidBalance,
        };
      });
  }, [suppliers, orders, deliveries, invoices, payments, supplierFilter]);

  const gradeSummaryRows = useMemo(() => {
    const map = new Map<
      string,
      {
        productName: string;
        tankerCount: number;
        invoicedLitres: number;
        receivedLitres: number;
        shortageLitres: number;
        totalAmount: number;
        densitySum: number;
      }
    >();

    for (const d of deliveries) {
      if (supplierFilter !== 'ALL' && d.supplierId !== supplierFilter) continue;
      const existing = map.get(d.productName) ?? {
        productName: d.productName,
        tankerCount: 0,
        invoicedLitres: 0,
        receivedLitres: 0,
        shortageLitres: 0,
        totalAmount: 0,
        densitySum: 0,
      };
      existing.tankerCount += 1;
      existing.invoicedLitres += d.invoicedQtyLitres;
      existing.receivedLitres += d.receivedQtyLitres;
      existing.shortageLitres += d.shortageLitres;
      existing.totalAmount += d.totalInvoiceAmount;
      existing.densitySum += d.densityObserved;
      map.set(d.productName, existing);
    }

    return Array.from(map.values());
  }, [deliveries, supplierFilter]);

  const agingBuckets = useMemo(() => {
    const todayMs = new Date(`${todayIso}T00:00:00`).getTime();
    const buckets = {
      current: 0,
      d1_15: 0,
      d16_30: 0,
      d30Plus: 0,
    };

    for (const inv of invoices) {
      if (supplierFilter !== 'ALL' && inv.supplierId !== supplierFilter) continue;
      if (inv.paymentStatus === 'PAID') continue;
      const bal = Math.max(0, inv.totalAmount - inv.paidAmount);
      const dueMs = new Date(`${inv.dueDate}T00:00:00`).getTime();
      const diffDays = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) buckets.current += bal;
      else if (diffDays <= 15) buckets.d1_15 += bal;
      else if (diffDays <= 30) buckets.d16_30 += bal;
      else buckets.d30Plus += bal;
    }

    return buckets;
  }, [invoices, supplierFilter, todayIso]);

  const handleExportCsv = () => {
    const header = [
      'Supplier Code',
      'Supplier Name',
      'Category',
      'PO Count',
      'Ordered Litres',
      'Received Litres',
      'Transit Shortage Litres',
      'Total Billed (PKR)',
      'Total Paid (PKR)',
      'Open Payable (PKR)',
    ].join(',');

    const rows = supplierSpendRows.map((r) =>
      [
        r.supplier.supplierCode,
        `"${r.supplier.name.replace(/"/g, '""')}"`,
        r.supplier.category,
        r.poCount,
        r.orderedLitres.toFixed(2),
        r.receivedLitres.toFixed(2),
        r.shortageLitres.toFixed(2),
        r.totalBilled.toFixed(2),
        r.totalPaid.toFixed(2),
        r.unpaidBalance.toFixed(2),
      ].join(',')
    );

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase_management_report_${todayIso}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Filter & Export Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Filter Supplier:</label>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
          >
            <option value="ALL">All Approved Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Purchase CSV</span>
        </button>
      </div>

      {/* Payables Aging Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Current (Within Credit Term)</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(agingBuckets.current)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Not yet due as of {todayIso}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">1–15 Days Overdue</div>
          <div
            className={`mt-1 text-xl font-bold font-mono tabular-nums ${
              agingBuckets.d1_15 > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
            }`}
          >
            {formatCurrency(agingBuckets.d1_15)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Immediate remittance queue</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">16–30 Days Overdue</div>
          <div
            className={`mt-1 text-xl font-bold font-mono tabular-nums ${
              agingBuckets.d16_30 > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
            }`}
          >
            {formatCurrency(agingBuckets.d16_30)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Credit hold risk</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">30+ Days Overdue</div>
          <div
            className={`mt-1 text-xl font-bold font-mono tabular-nums ${
              agingBuckets.d30Plus > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
            }`}
          >
            {formatCurrency(agingBuckets.d30Plus)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Escalated vendor balance</div>
        </div>
      </div>

      {/* Report 1: Spend & Volume by Supplier */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Supplier Procurement & Payable Reconciliation
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Consolidated view of indents, decanted fuel volumes, transit losses, and open vendor dues.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4 text-right">POs / GRNs</th>
                <th className="py-3 px-4 text-right">Ordered Qty</th>
                <th className="py-3 px-4 text-right">Received Qty</th>
                <th className="py-3 px-4 text-right">Shortage</th>
                <th className="py-3 px-4 text-right">Total Billed</th>
                <th className="py-3 px-4 text-right">Total Paid</th>
                <th className="py-3 px-4 text-right">Open Payable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {supplierSpendRows.map((row) => (
                <tr key={row.supplier.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900 dark:text-white">{row.supplier.name}</div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {row.supplier.supplierCode} · Net {row.supplier.paymentTermsDays}d
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {row.poCount} / {row.deliveryCount}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {formatLitres(row.orderedLitres)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white font-medium">
                    {formatLitres(row.receivedLitres)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
                    {row.shortageLitres > 0 ? `-${formatLitres(row.shortageLitres)}` : '0.00 L'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(row.totalBilled)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(row.totalPaid)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(row.unpaidBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Report 2: Fuel Grade Transit Loss & Density Analysis */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Fuel Grade Intake & Transit Shortage Analysis
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Invoiced tanker volumes compared against post-decant storage tank dip receipts and average observed density.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Fuel / Product Grade</th>
                <th className="py-3 px-4 text-right">Tanker Loads</th>
                <th className="py-3 px-4 text-right">Invoiced Volume</th>
                <th className="py-3 px-4 text-right">Received Volume</th>
                <th className="py-3 px-4 text-right">Net Shortage</th>
                <th className="py-3 px-4 text-right">Loss %</th>
                <th className="py-3 px-4 text-right">Avg Density</th>
                <th className="py-3 px-4 text-right">Total Purchase Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {gradeSummaryRows.map((g) => {
                const lossPct = g.invoicedLitres > 0 ? +((g.shortageLitres / g.invoicedLitres) * 100).toFixed(3) : 0;
                const avgDensity = g.tankerCount > 0 ? g.densitySum / g.tankerCount : 0;
                return (
                  <tr key={g.productName} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{g.productName}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {g.tankerCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatLitres(g.invoicedLitres)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                      {formatLitres(g.receivedLitres)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
                      -{formatLitres(g.shortageLitres)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-medium ${
                        lossPct > 0.25 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {lossPct}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {avgDensity.toFixed(4)} g/mL
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(g.totalAmount)}
                    </td>
                  </tr>
                );
              })}
              {gradeSummaryRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No fuel deliveries recorded for the selected supplier filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
