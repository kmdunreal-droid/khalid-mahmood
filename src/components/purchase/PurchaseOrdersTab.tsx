import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Plus,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import { ActiveRolePersona } from '../../data/shiftTypes';
import {
  FUEL_TANK_OPTIONS,
  PurchaseOrderItem,
  PurchaseOrderRecord,
  PurchaseOrderStatus,
  SupplierRecord,
} from '../../data/purchaseTypes';
import { formatCurrency, formatLitres } from '../../utils/shiftMath';

interface PurchaseOrdersTabProps {
  suppliers: SupplierRecord[];
  orders: PurchaseOrderRecord[];
  rolePersona: ActiveRolePersona;
  onCreateOrder: (
    order: Omit<PurchaseOrderRecord, 'id' | 'stationId' | 'createdByUid'>
  ) => Promise<void> | void;
  onUpdateOrderStatus: (id: string, nextStatus: PurchaseOrderStatus) => Promise<void> | void;
  onReceiveFromPo: (po: PurchaseOrderRecord) => void;
}

const MANAGER_PO_APPROVAL_CAP = 1500000;

export const PurchaseOrdersTab: React.FC<PurchaseOrdersTabProps> = ({
  suppliers,
  orders,
  rolePersona,
  onCreateOrder,
  onUpdateOrderStatus,
  onReceiveFromPo,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | PurchaseOrderStatus>('ALL');
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.status === 'ACTIVE'),
    [suppliers]
  );

  const [supplierId, setSupplierId] = useState<string>(activeSuppliers[0]?.id ?? suppliers[0]?.id ?? '');
  const [poNumber, setPoNumber] = useState<string>(`PO-2026-${118 + orders.length}`);
  const [orderDate, setOrderDate] = useState<string>('2026-11-23');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('2026-11-24');
  const [notes, setNotes] = useState<string>('');
  const [issueImmediately, setIssueImmediately] = useState<boolean>(false);
  const [items, setItems] = useState<PurchaseOrderItem[]>([
    {
      productName: FUEL_TANK_OPTIONS[1].productName,
      gradeCode: FUEL_TANK_OPTIONS[1].gradeCode,
      orderedLitres: 12000,
      unitRate: FUEL_TANK_OPTIONS[1].defaultRate,
      taxPct: 0,
      lineTotal: +(12000 * FUEL_TANK_OPTIONS[1].defaultRate).toFixed(2),
    },
  ]);

  const filteredOrders = useMemo(
    () => orders.filter((po) => statusFilter === 'ALL' || po.status === statusFilter),
    [orders, statusFilter]
  );

  const totalOrderLitres = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.orderedLitres) || 0), 0),
    [items]
  );

  const totalEstimatedAmount = useMemo(
    () => +items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2),
    [items]
  );

  const handleItemChange = (index: number, patch: Partial<PurchaseOrderItem>) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const merged = { ...item, ...patch };
        const base = (Number(merged.orderedLitres) || 0) * (Number(merged.unitRate) || 0);
        const taxFactor = 1 + (Number(merged.taxPct) || 0) / 100;
        return {
          ...merged,
          lineTotal: +(base * taxFactor).toFixed(2),
        };
      })
    );
  };

  const handleSelectPresetProduct = (index: number, productName: string) => {
    const preset = FUEL_TANK_OPTIONS.find((p) => p.productName === productName);
    if (!preset) return;
    handleItemChange(index, {
      productName: preset.productName,
      gradeCode: preset.gradeCode,
      unitRate: preset.defaultRate,
      taxPct: preset.gradeCode === 'LUBE' ? 18 : 0,
    });
  };

  const handleAddLine = () => {
    if (items.length >= 6) return;
    const preset = FUEL_TANK_OPTIONS[0];
    setItems((prev) => [
      ...prev,
      {
        productName: preset.productName,
        gradeCode: preset.gradeCode,
        orderedLitres: 4000,
        unitRate: preset.defaultRate,
        taxPct: 0,
        lineTotal: +(4000 * preset.defaultRate).toFixed(2),
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const chosenSupplier = suppliers.find((s) => s.id === supplierId);
    if (!chosenSupplier) {
      setFormError('Please select an active supplier.');
      return;
    }
    if (poNumber.trim().length < 3) {
      setFormError('PO Number must be at least 3 characters.');
      return;
    }
    if (items.some((it) => it.orderedLitres <= 0 || it.unitRate <= 0)) {
      setFormError('Every line item must have positive quantity and unit rate.');
      return;
    }

    if (issueImmediately && rolePersona === 'MANAGER' && totalEstimatedAmount > MANAGER_PO_APPROVAL_CAP) {
      setFormError(
        `Manager direct PO approval is capped at ${formatCurrency(MANAGER_PO_APPROVAL_CAP)}. Uncheck "Issue immediately" to save as DRAFT for Owner approval.`
      );
      return;
    }

    const primaryGrade =
      items.length === 1
        ? items[0].productName.slice(0, 48)
        : `${items.map((i) => i.gradeCode).join(' + ')} (Split)`.slice(0, 48);

    setSaving(true);
    try {
      await onCreateOrder({
        supplierId: chosenSupplier.id,
        supplierName: chosenSupplier.name,
        poNumber: poNumber.trim().slice(0, 32),
        orderDate,
        expectedDeliveryDate,
        primaryFuelGrade: primaryGrade,
        totalOrderedLitres: totalOrderLitres,
        receivedLitres: 0,
        items,
        notes: notes.trim().slice(0, 400),
        status: issueImmediately ? 'ORDERED' : 'DRAFT',
        totalEstimatedAmount,
      });
      setShowCreateForm(false);
      setNotes('');
      setPoNumber(`PO-2026-${119 + orders.length}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to create Purchase Order.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter + Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-fit">
          {(['ALL', 'DRAFT', 'ORDERED', 'PARTIAL', 'RECEIVED', 'CANCELLED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === st
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st === 'ALL' ? `All POs (${orders.length})` : st}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setShowCreateForm((v) => !v);
          }}
          className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Purchase Order</span>
        </button>
      </div>

      {/* Create PO Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Raise Fuel / Lubricant Purchase Order</span>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              aria-label="Close PO form"
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
                Supplier / OMC Depot
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.status !== 'ACTIVE'}>
                    {s.name} ({s.supplierCode}) {s.status !== 'ACTIVE' ? `[${s.status}]` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                PO Indent Number
              </label>
              <input
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                maxLength={32}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Order Date
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  required
                  className="w-full px-2 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Expected ETA
                </label>
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  required
                  className="w-full px-2 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Order Line Items</span>
              <button
                type="button"
                onClick={handleAddLine}
                disabled={items.length >= 6}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40"
              >
                + Add Compartment / Grade
              </button>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3">Product / Grade</th>
                    <th className="py-2.5 px-3 text-right">Qty (L / Units)</th>
                    <th className="py-2.5 px-3 text-right">Rate (Rs.)</th>
                    <th className="py-2.5 px-3 text-right">Tax %</th>
                    <th className="py-2.5 px-3 text-right">Line Total</th>
                    <th className="py-2.5 px-3 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3">
                        <select
                          value={item.productName}
                          onChange={(e) => handleSelectPresetProduct(idx, e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                        >
                          {FUEL_TANK_OPTIONS.map((opt) => (
                            <option key={opt.tankCode} value={opt.productName}>
                              {opt.productName} ({opt.gradeCode})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min={1}
                          step="1"
                          value={item.orderedLitres}
                          onChange={(e) =>
                            handleItemChange(idx, { orderedLitres: Number(e.target.value) })
                          }
                          className="w-28 px-2 py-1.5 text-xs font-mono text-right border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min={0.01}
                          step="0.01"
                          value={item.unitRate}
                          onChange={(e) =>
                            handleItemChange(idx, { unitRate: Number(e.target.value) })
                          }
                          className="w-24 px-2 py-1.5 text-xs font-mono text-right border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min={0}
                          max={28}
                          step="0.5"
                          value={item.taxPct}
                          onChange={(e) =>
                            handleItemChange(idx, { taxPct: Number(e.target.value) })
                          }
                          className="w-16 px-2 py-1.5 text-xs font-mono text-right border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                        {formatCurrency(item.lineTotal)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          disabled={items.length <= 1}
                          className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-30"
                        >
                          <X className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Indent Remarks / Slot Preference
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={400}
                placeholder="e.g., Requesting morning tanker calibration slot"
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-lg"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5">
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Total Indent Estimate</div>
                <div className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                  {formatLitres(totalOrderLitres)} · {formatCurrency(totalEstimatedAmount)}
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={issueImmediately}
                  onChange={(e) => setIssueImmediately(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600"
                />
                <span>Approve & Issue Immediately</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Submitting...' : issueImmediately ? 'Issue Purchase Order' : 'Save Draft PO'}
            </button>
          </div>
        </form>
      )}

      {/* PO Register Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Supplier & Grade</th>
                <th className="py-3 px-4">Dates</th>
                <th className="py-3 px-4 text-right">Ordered / Received</th>
                <th className="py-3 px-4 text-right">Estimated Value</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {filteredOrders.map((po) => {
                const needsOwnerApproval =
                  po.status === 'DRAFT' &&
                  rolePersona === 'MANAGER' &&
                  po.totalEstimatedAmount > MANAGER_PO_APPROVAL_CAP;
                const isExpanded = expandedPoId === po.id;

                return (
                  <React.Fragment key={po.id}>
                    <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 align-top">
                        <button
                          type="button"
                          onClick={() => setExpandedPoId(isExpanded ? null : po.id)}
                          className="font-mono font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                        >
                          {po.poNumber}
                        </button>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {po.items.length} line item{po.items.length > 1 ? 's' : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <div className="font-medium text-slate-900 dark:text-white">{po.supplierName}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{po.primaryFuelGrade}</div>
                      </td>
                      <td className="py-3 px-4 align-top font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-400">
                        <div>Issued: {po.orderDate}</div>
                        <div>ETA: {po.expectedDeliveryDate}</div>
                      </td>
                      <td className="py-3 px-4 align-top text-right font-mono tabular-nums">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {formatLitres(po.totalOrderedLitres)}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Rcvd: {formatLitres(po.receivedLitres)}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(po.totalEstimatedAmount)}
                      </td>
                      <td className="py-3 px-4 align-top">
                        {po.status === 'RECEIVED' && (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Received</span>
                          </span>
                        )}
                        {po.status === 'ORDERED' && (
                          <span className="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Ordered</span>
                          </span>
                        )}
                        {po.status === 'PARTIAL' && (
                          <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                            <Truck className="w-3.5 h-3.5" />
                            <span>Partial Receipt</span>
                          </span>
                        )}
                        {po.status === 'DRAFT' && (
                          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
                            <ClipboardList className="w-3.5 h-3.5" />
                            <span>Draft</span>
                          </span>
                        )}
                        {po.status === 'CANCELLED' && (
                          <span className="inline-flex items-center gap-1.5 text-red-700 dark:text-red-400 font-medium">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Cancelled</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 align-top text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          {po.status === 'DRAFT' && (
                            <button
                              type="button"
                              disabled={needsOwnerApproval}
                              title={
                                needsOwnerApproval
                                  ? `Exceeds Manager approval cap (${formatCurrency(MANAGER_PO_APPROVAL_CAP)}). Owner approval required.`
                                  : 'Approve and transmit PO to supplier'
                              }
                              onClick={() => onUpdateOrderStatus(po.id, 'ORDERED')}
                              className="px-2.5 py-1.5 text-[11px] font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-40 whitespace-nowrap"
                            >
                              {needsOwnerApproval ? 'Needs Owner' : 'Approve & Issue'}
                            </button>
                          )}
                          {(po.status === 'ORDERED' || po.status === 'PARTIAL') && (
                            <button
                              type="button"
                              onClick={() => onReceiveFromPo(po)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 whitespace-nowrap"
                            >
                              <Truck className="w-3 h-3" />
                              <span>Receive Tanker</span>
                            </button>
                          )}
                          {(po.status === 'DRAFT' || po.status === 'ORDERED') && (
                            <button
                              type="button"
                              onClick={() => onUpdateOrderStatus(po.id, 'CANCELLED')}
                              className="px-2 py-1 text-[11px] font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg whitespace-nowrap"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/70 dark:bg-slate-950/50">
                        <td colSpan={7} className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                            <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                              Compartment / Line Breakdown · {po.notes || 'No special dispatch remarks'}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {po.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-medium text-slate-900 dark:text-white">{item.productName}</div>
                                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                    {formatLitres(item.orderedLitres)} × Rs. {item.unitRate.toFixed(2)}
                                    {item.taxPct > 0 ? ` + ${item.taxPct}% Tax` : ''}
                                  </div>
                                </div>
                                <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                                  {formatCurrency(item.lineTotal)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No purchase orders match the selected status filter.
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
