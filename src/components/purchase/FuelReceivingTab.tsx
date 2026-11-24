import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Plus,
  Truck,
  X,
} from 'lucide-react';
import {
  FUEL_TANK_OPTIONS,
  FuelDeliveryRecord,
  FuelDeliveryStatus,
  PurchaseOrderRecord,
  SupplierRecord,
} from '../../data/purchaseTypes';
import { formatCurrency, formatLitres } from '../../utils/shiftMath';

interface FuelReceivingTabProps {
  suppliers: SupplierRecord[];
  orders: PurchaseOrderRecord[];
  deliveries: FuelDeliveryRecord[];
  preselectedPo: PurchaseOrderRecord | null;
  onClearPreselectedPo: () => void;
  onRecordDelivery: (
    delivery: Omit<FuelDeliveryRecord, 'id' | 'stationId' | 'verifiedByUid'>,
    options: { autoCreateInvoice: boolean; invoiceDueDays: number }
  ) => Promise<void> | void;
  onUpdateDeliveryStatus: (id: string, status: FuelDeliveryStatus) => Promise<void> | void;
}

export const FuelReceivingTab: React.FC<FuelReceivingTabProps> = ({
  suppliers,
  orders,
  deliveries,
  preselectedPo,
  onClearPreselectedPo,
  onRecordDelivery,
  onUpdateDeliveryStatus,
}) => {
  const openOrders = useMemo(
    () => orders.filter((o) => o.status === 'ORDERED' || o.status === 'PARTIAL'),
    [orders]
  );

  const [showGrnForm, setShowGrnForm] = useState<boolean>(Boolean(preselectedPo));
  const [selectedPoId, setSelectedPoId] = useState<string>(preselectedPo?.id ?? openOrders[0]?.id ?? '');
  const [supplierId, setSupplierId] = useState<string>(
    preselectedPo?.supplierId ?? openOrders[0]?.supplierId ?? suppliers[0]?.id ?? ''
  );
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>('2026-11-23');
  const [tankerRegNo, setTankerRegNo] = useState<string>('KA-01-AG-7742');
  const [driverName, setDriverName] = useState<string>('');
  const [productName, setProductName] = useState<string>(FUEL_TANK_OPTIONS[2].productName);
  const [targetTankCode, setTargetTankCode] = useState<string>(FUEL_TANK_OPTIONS[2].tankCode);
  const [invoicedQtyLitres, setInvoicedQtyLitres] = useState<string>('6000');
  const [receivedQtyLitres, setReceivedQtyLitres] = useState<string>('5988');
  const [densityObserved, setDensityObserved] = useState<string>('0.7478');
  const [temperatureC, setTemperatureC] = useState<string>('26.4');
  const [waterDipMm, setWaterDipMm] = useState<string>('0');
  const [totalInvoiceAmount, setTotalInvoiceAmount] = useState<string>('568800');
  const [autoCreateInvoice, setAutoCreateInvoice] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const applyPoDefaults = (po: PurchaseOrderRecord | undefined) => {
    if (!po) return;
    setSelectedPoId(po.id);
    setSupplierId(po.supplierId);
    const firstItem = po.items[0];
    if (firstItem) {
      const tank = FUEL_TANK_OPTIONS.find((t) => t.gradeCode === firstItem.gradeCode);
      setProductName(firstItem.productName);
      if (tank) {
        setTargetTankCode(tank.tankCode);
        setDensityObserved(String(tank.defaultDensity));
      }
      const remaining = Math.max(0, po.totalOrderedLitres - po.receivedLitres) || firstItem.orderedLitres;
      setInvoicedQtyLitres(String(remaining));
      setReceivedQtyLitres(String(remaining));
      setTotalInvoiceAmount(String(+(remaining * firstItem.unitRate).toFixed(2)));
    }
  };

  useEffect(() => {
    if (preselectedPo) {
      setShowGrnForm(true);
      applyPoDefaults(preselectedPo);
    }
  }, [preselectedPo]);

  const parsedInvoiced = Number(invoicedQtyLitres) || 0;
  const parsedReceived = Number(receivedQtyLitres) || 0;
  const computedShortage = +(parsedInvoiced - parsedReceived).toFixed(2);
  const shortagePct = parsedInvoiced > 0 ? +((computedShortage / parsedInvoiced) * 100).toFixed(3) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) {
      setFormError('Select a valid supplier.');
      return;
    }
    if (invoiceNumber.trim().length < 2 || tankerRegNo.trim().length < 4) {
      setFormError('Invoice number and tanker registration number are required.');
      return;
    }
    if (parsedInvoiced <= 0 || parsedReceived < 0) {
      setFormError('Invoiced quantity must be greater than zero.');
      return;
    }
    const density = Number(densityObserved);
    const temp = Number(temperatureC);
    const water = Number(waterDipMm);
    const amt = Number(totalInvoiceAmount);
    if (!Number.isFinite(density) || density <= 0 || !Number.isFinite(temp) || water < 0 || amt < 0) {
      setFormError('Enter valid hydrometer density, temperature, water dip, and invoice amount.');
      return;
    }

    const linkedPo = orders.find((o) => o.id === selectedPoId);
    setSaving(true);
    try {
      await onRecordDelivery(
        {
          poId: linkedPo?.id,
          poNumber: linkedPo?.poNumber,
          supplierId: supplier.id,
          supplierName: supplier.name,
          invoiceNumber: invoiceNumber.trim().slice(0, 48),
          deliveryDate,
          tankerRegNo: tankerRegNo.trim().toUpperCase().slice(0, 24),
          driverName: driverName.trim().slice(0, 100),
          productName: productName.slice(0, 100),
          targetTankCode: targetTankCode.slice(0, 16),
          invoicedQtyLitres: parsedInvoiced,
          receivedQtyLitres: parsedReceived,
          shortageLitres: computedShortage,
          densityObserved: density,
          temperatureC: temp,
          waterDipMm: water,
          totalInvoiceAmount: amt,
          status: 'DECANTED',
        },
        {
          autoCreateInvoice,
          invoiceDueDays: supplier.paymentTermsDays,
        }
      );
      setShowGrnForm(false);
      onClearPreselectedPo();
      setInvoiceNumber('');
      setDriverName('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to record tanker delivery.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-slate-600 dark:text-slate-400">
          Capture OMC tanker arrival, density, temperature, dip reconciliation, and decanting status.
        </div>
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setShowGrnForm((v) => !v);
          }}
          className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Log Tanker Receiving (GRN)</span>
        </button>
      </div>

      {showGrnForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Tanker Goods Receipt & Quality Inspection</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowGrnForm(false);
                onClearPreselectedPo();
              }}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              aria-label="Close GRN form"
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
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Linked Purchase Order
              </label>
              <select
                value={selectedPoId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedPoId(id);
                  applyPoDefaults(orders.find((o) => o.id === id));
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="">Direct Unscheduled Delivery</option>
                {openOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.poNumber} · {o.primaryFuelGrade}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Supplier / Depot
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                OMC Chalan / Invoice No.
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                maxLength={48}
                required
                placeholder="PSO-INV-55390"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Receiving Date
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Tanker Registration No.
              </label>
              <input
                type="text"
                value={tankerRegNo}
                onChange={(e) => setTankerRegNo(e.target.value)}
                maxLength={24}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg uppercase"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Tanker Driver Name
              </label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                maxLength={100}
                placeholder="Driver full name"
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Target Storage Tank & Grade
              </label>
              <select
                value={targetTankCode}
                onChange={(e) => {
                  const code = e.target.value;
                  setTargetTankCode(code);
                  const tank = FUEL_TANK_OPTIONS.find((t) => t.tankCode === code);
                  if (tank) {
                    setProductName(tank.productName);
                    setDensityObserved(String(tank.defaultDensity));
                  }
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {FUEL_TANK_OPTIONS.map((t) => (
                  <option key={t.tankCode} value={t.tankCode}>
                    {t.tankCode} — {t.productName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Total Invoice Amount (Rs.)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={totalInvoiceAmount}
                onChange={(e) => setTotalInvoiceAmount(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Invoiced Quantity (Litres)
              </label>
              <input
                type="number"
                min={1}
                step="1"
                value={invoicedQtyLitres}
                onChange={(e) => setInvoicedQtyLitres(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Post-Dip Received (Litres)
              </label>
              <input
                type="number"
                min={0}
                step="1"
                value={receivedQtyLitres}
                onChange={(e) => setReceivedQtyLitres(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Observed Density (g/mL)
              </label>
              <input
                type="number"
                min={0.5}
                max={1.2}
                step="0.0001"
                value={densityObserved}
                onChange={(e) => setDensityObserved(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Temp (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={temperatureC}
                  onChange={(e) => setTemperatureC(e.target.value)}
                  required
                  className="w-full px-2 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Water Dip (mm)
                </label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={waterDipMm}
                  onChange={(e) => setWaterDipMm(e.target.value)}
                  required
                  className="w-full px-2 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <Droplets className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <div className="text-xs">
                <span className="text-slate-500 dark:text-slate-400">Computed Transit Variance: </span>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    shortagePct > 0.25 ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {computedShortage >= 0 ? `-${formatLitres(computedShortage)} Shortage` : `+${formatLitres(Math.abs(computedShortage))} Gain`} ({shortagePct}%)
                </span>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoCreateInvoice}
                onChange={(e) => setAutoCreateInvoice(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600"
              />
              <span>Auto-register Unpaid Supplier Invoice</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setShowGrnForm(false);
                onClearPreselectedPo();
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
              {saving ? 'Recording GRN...' : 'Confirm Decant & Save GRN'}
            </button>
          </div>
        </form>
      )}

      {/* Tanker Deliveries Register */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Delivery / Tanker</th>
                <th className="py-3 px-4">Supplier & Linked PO</th>
                <th className="py-3 px-4">Product & Tank</th>
                <th className="py-3 px-4 text-right">Density / Temp</th>
                <th className="py-3 px-4 text-right">Invoiced vs Rcvd</th>
                <th className="py-3 px-4 text-right">Shortage</th>
                <th className="py-3 px-4 text-right">Invoice Value</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {deliveries.map((d) => {
                const pct = d.invoicedQtyLitres > 0 ? +((d.shortageLitres / d.invoicedQtyLitres) * 100).toFixed(2) : 0;
                const highLoss = pct > 0.25;
                return (
                  <tr key={d.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 align-top">
                      <div className="font-mono font-semibold text-slate-900 dark:text-white">{d.invoiceNumber}</div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                        {d.deliveryDate} · {d.tankerRegNo}
                      </div>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="font-medium text-slate-900 dark:text-white">{d.supplierName}</div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                        {d.poNumber ? `Linked: ${d.poNumber}` : 'Direct Unscheduled'}
                      </div>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="text-slate-900 dark:text-slate-100">{d.productName}</div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                        Tank {d.targetTankCode} · Water {d.waterDipMm}mm
                      </div>
                    </td>
                    <td className="py-3 px-4 align-top text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      <div>{d.densityObserved.toFixed(4)} g/mL</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{d.temperatureC.toFixed(1)} °C</div>
                    </td>
                    <td className="py-3 px-4 align-top text-right font-mono tabular-nums">
                      <div className="text-slate-600 dark:text-slate-400">{formatLitres(d.invoicedQtyLitres)}</div>
                      <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                        {formatLitres(d.receivedQtyLitres)}
                      </div>
                    </td>
                    <td className="py-3 px-4 align-top text-right font-mono tabular-nums">
                      <div className={highLoss ? 'font-semibold text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}>
                        {d.shortageLitres > 0 ? `-${formatLitres(d.shortageLitres)}` : formatLitres(Math.abs(d.shortageLitres))}
                      </div>
                      <div className={`text-[11px] mt-0.5 ${highLoss ? 'text-red-700 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {pct}% {highLoss ? 'Excess Loss' : 'Within Norm'}
                      </div>
                    </td>
                    <td className="py-3 px-4 align-top text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(d.totalInvoiceAmount)}
                    </td>
                    <td className="py-3 px-4 align-top">
                      {d.status === 'POSTED' ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Posted to Stock</span>
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-medium">
                            <Truck className="w-3.5 h-3.5" />
                            <span>{d.status}</span>
                          </span>
                          <div>
                            <button
                              type="button"
                              onClick={() => onUpdateDeliveryStatus(d.id, 'POSTED')}
                              className="text-[11px] font-medium text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap"
                            >
                              Post to Stock Ledger
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {deliveries.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No tanker fuel deliveries recorded yet.
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
