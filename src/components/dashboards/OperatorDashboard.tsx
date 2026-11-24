import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  CreditCard,
  Fuel,
  Plus,
  QrCode,
  Send,
  Square,
  Wallet,
} from 'lucide-react';
import { INITIAL_NOZZLE_CONFIGS } from '../../data/salesSeedData';
import { SalePaymentMode } from '../../data/salesTypes';
import { DashboardTelemetryState } from '../../hooks/useDashboardTelemetry';
import {
  computeNozzleMetrics,
  computeShiftSummary,
  formatCurrency,
  formatLitres,
} from '../../utils/shiftMath';
import { ArchitectureTab } from '../OverviewSection';

interface OperatorDashboardProps {
  telemetry: DashboardTelemetryState;
  onNavigateTab: (tab: ArchitectureTab) => void;
}

export const OperatorDashboard: React.FC<OperatorDashboardProps> = ({
  telemetry,
  onNavigateTab,
}) => {
  const activeShift = useMemo(
    () => telemetry.shifts.find((s) => s.status === 'OPEN') ?? telemetry.shifts[0],
    [telemetry.shifts]
  );

  const shiftSummary = useMemo(
    () => (activeShift ? computeShiftSummary(activeShift) : null),
    [activeShift]
  );

  // Quick Forecourt Sale State (thumb-first mobile entry)
  const [selectedNozzle, setSelectedNozzle] = useState<string>(
    INITIAL_NOZZLE_CONFIGS[0].nozzleCode
  );
  const [litresInput, setLitresInput] = useState<string>('25');
  const [paymentMode, setPaymentMode] = useState<SalePaymentMode>('UPI');
  const [vehicleNo, setVehicleNo] = useState<string>('');
  const [paymentRef, setPaymentRef] = useState<string>('');

  // Handover State
  const [cashBagSeal, setCashBagSeal] = useState<string>(
    activeShift?.handover.cashBagSealNo || 'BAG-DAY-2311-01'
  );
  const [cashCountInput, setCashCountInput] = useState<string>(
    String(Math.round(shiftSummary?.actualCashCollected ?? 428500))
  );
  const [checklist, setChecklist] = useState(
    activeShift?.handover.checklist ?? {
      cashCountVerified: true,
      dipStickRecorded: true,
      creditSlipsBundled: true,
      dispenserSealsIntact: true,
    }
  );

  const [dispenserImgError, setDispenserImgError] = useState(false);

  const selectedConfig =
    INITIAL_NOZZLE_CONFIGS.find((n) => n.nozzleCode === selectedNozzle) ??
    INITIAL_NOZZLE_CONFIGS[0];

  const parsedLitres = Math.max(0, Number(litresInput) || 0);
  const estimatedSaleTotal = +(parsedLitres * selectedConfig.unitSellingPrice).toFixed(2);

  const operatorSales = useMemo(
    () => telemetry.sales.filter((s) => s.status === 'POSTED').slice(0, 6),
    [telemetry.sales]
  );

  const handleQuickSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedLitres <= 0) return;
    await telemetry.recordOperatorQuickSale({
      nozzleCode: selectedNozzle,
      quantityLitres: parsedLitres,
      paymentMode,
      vehicleNo,
      paymentReference: paymentRef,
    });
    setVehicleNo('');
    setPaymentRef('');
  };

  const allChecklistDone = Object.values(checklist).every(Boolean);

  return (
    <div className="space-y-5">
      {/* Mobile-First Active Shift Header Banner */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-8 p-4 sm:p-6 flex flex-col justify-between">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Forecourt Attendant Terminal · {telemetry.stationId}
                </div>
                <h2 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight text-balance">
                  Active Bay Shift: {activeShift?.shiftCode ?? 'SHF-ACTIVE'}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {activeShift?.shiftType ?? 'DAY'} Shift ({activeShift?.timeWindow ?? '06:00 – 18:00'}) · Status:{' '}
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {activeShift?.status ?? 'OPEN'}
                  </span>
                </p>
              </div>
            </div>

            {/* 4-Metric Touch KPI Row (2 cols on phone, 4 on desktop) */}
            <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Volume Dispensed
                </div>
                <div className="mt-1 text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {formatLitres(shiftSummary?.totalLitresDispensed ?? 0)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Meter Sales Value
                </div>
                <div className="mt-1 text-base sm:text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(shiftSummary?.totalMeterSales ?? 0)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Expected Cash
                </div>
                <div className="mt-1 text-base sm:text-lg font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
                  {formatCurrency(shiftSummary?.expectedCashInDrawer ?? 0)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Online & Card
                </div>
                <div className="mt-1 text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {formatCurrency(
                    (activeShift?.tenders.upiAmount ?? 0) +
                      (activeShift?.tenders.cardAmount ?? 0)
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 relative min-h-[160px] bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800">
            {!dispenserImgError ? (
              <img
                src="/src/assets/images/forecourt_dispenser_bay_1795435125492.jpg"
                alt="Assigned Island Dispenser"
                referrerPolicy="no-referrer"
                onError={() => setDispenserImgError(true)}
                className="w-full h-full object-cover lg:absolute lg:inset-0"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-950 to-emerald-950" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 text-white">
              <div className="text-[11px] text-emerald-300 font-medium">
                Island A & B Assigned
              </div>
              <div className="text-sm font-bold">
                {activeShift?.nozzles.length ?? 6} Nozzles Synchronized
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Mobile-First Workspace Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: 1-Tap Quick Forecourt Sale Terminal */}
        <form
          onSubmit={handleQuickSaleSubmit}
          className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
        >
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Quick Forecourt Sale Entry
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Thumb-optimized nozzle & payment logger for island attendants
            </p>
          </div>

          {/* Nozzle Selector Grid (44px+ buttons) */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              1. Select Active Nozzle
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {INITIAL_NOZZLE_CONFIGS.map((nozzle) => {
                const isSelected = selectedNozzle === nozzle.nozzleCode;
                return (
                  <button
                    key={nozzle.nozzleCode}
                    type="button"
                    onClick={() => setSelectedNozzle(nozzle.nozzleCode)}
                    className={`min-h-[48px] p-2.5 rounded-xl border text-left transition-colors ${
                      isSelected
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 hover:border-blue-400'
                    }`}
                  >
                    <div className="text-xs font-mono font-bold">{nozzle.nozzleCode}</div>
                    <div
                      className={`text-[11px] font-mono tabular-nums ${
                        isSelected ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {nozzle.gradeCode} · Rs. {nozzle.unitSellingPrice.toFixed(2)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Litres + Custom Input */}
          <div>
            <label
              htmlFor="operator-litres-input"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              2. Dispensed Quantity (Litres)
            </label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[10, 20, 50, 100].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLitresInput(String(preset))}
                  className={`min-h-[44px] rounded-lg text-xs font-mono font-semibold border transition-colors ${
                    Number(litresInput) === preset
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {preset} L
                </button>
              ))}
            </div>
            <input
              id="operator-litres-input"
              type="number"
              step="0.1"
              min="0.5"
              value={litresInput}
              onChange={(e) => setLitresInput(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono tabular-nums text-base font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Payment Tender Mode (44px+ touch buttons) */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              3. Payment Mode
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'CASH', label: 'Cash', icon: <Wallet className="w-3.5 h-3.5" /> },
                  { id: 'UPI', label: 'Online / QR', icon: <QrCode className="w-3.5 h-3.5" /> },
                  { id: 'CARD', label: 'Card', icon: <CreditCard className="w-3.5 h-3.5" /> },
                  { id: 'CREDIT', label: 'Fleet', icon: <Fuel className="w-3.5 h-3.5" /> },
                ] as { id: SalePaymentMode; label: string; icon: React.ReactNode }[]
              ).map((mode) => {
                const active = paymentMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setPaymentMode(mode.id)}
                    className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      active
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {mode.icon}
                    <span>{mode.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              placeholder="Vehicle No. (optional)"
              value={vehicleNo}
              onChange={(e) => setVehicleNo(e.target.value)}
              className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Online / Slip Ref (optional)"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Computed Total + Large Thumb Submit */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Billable Amount
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(estimatedSaleTotal)}
              </div>
            </div>
            <button
              type="submit"
              disabled={telemetry.busyActionId === 'quick-sale' || parsedLitres <= 0}
              className="min-h-[48px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>
                {telemetry.busyActionId === 'quick-sale' ? 'Posting...' : 'Post Forecourt Sale'}
              </span>
            </button>
          </div>
        </form>

        {/* Right: Assigned Nozzle Totalizers & Shift Handover Checklist */}
        <div className="lg:col-span-7 space-y-5">
          {/* Assigned Nozzle Readings */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Assigned Dispenser Totalizers
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Live meter deltas for active shift
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:gap-px bg-slate-200 dark:bg-slate-800">
              {(activeShift?.nozzles ?? []).slice(0, 4).map((nozzle) => {
                const m = computeNozzleMetrics(nozzle);
                return (
                  <div
                    key={nozzle.nozzleId}
                    className="bg-white dark:bg-slate-900 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400">
                        {nozzle.dispenserCode} · {nozzle.nozzleCode}
                      </span>
                      <span className="font-mono text-xs tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatLitres(m.netLitres)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                      {nozzle.productName} · {nozzle.operatorName}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 pt-1">
                      <span>Open: {nozzle.openingReading.toFixed(1)}</span>
                      <span>Close: {nozzle.closingReading.toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shift Handover & Cash Bag Seal Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  End-of-Shift Handover Checklist
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verify safety seals and submit cash drop to Station Manager
                </p>
              </div>
              <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">
                {Object.values(checklist).filter(Boolean).length}/4 Ready
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(
                [
                  { key: 'cashCountVerified', label: 'Physical Cash Denomination Counted' },
                  { key: 'dipStickRecorded', label: 'Tank Dip Stick Reading Logged' },
                  { key: 'creditSlipsBundled', label: 'Fleet Credit & POS Slips Bundled' },
                  { key: 'dispenserSealsIntact', label: 'Nozzle & Totalizer Seals Intact' },
                ] as const
              ).map((item) => {
                const checked = checklist[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      setChecklist((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                    }
                    className={`min-h-[48px] px-3.5 py-2.5 rounded-xl border text-left text-xs font-medium flex items-center gap-2.5 transition-colors ${
                      checked
                        ? 'border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {checked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Cash Drop Count (Rs.)
                </label>
                <input
                  type="number"
                  value={cashCountInput}
                  onChange={(e) => setCashCountInput(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono tabular-nums text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Cash Bag Seal No.
                </label>
                <input
                  type="text"
                  value={cashBagSeal}
                  onChange={(e) => setCashBagSeal(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={
                    !activeShift ||
                    !allChecklistDone ||
                    activeShift.status !== 'OPEN' ||
                    telemetry.busyActionId === activeShift.id
                  }
                  onClick={() =>
                    activeShift &&
                    telemetry.submitOperatorHandover(
                      activeShift.id,
                      Number(cashCountInput) || 0,
                      cashBagSeal,
                      checklist
                    )
                  }
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {activeShift?.status === 'OPEN'
                      ? 'Submit Handover'
                      : `Status: ${activeShift?.status ?? 'DONE'}`}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Recent Operator Receipts Feed */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Recent Pump Receipts
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Last {operatorSales.length} transactions
              </span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {operatorSales.map((sale) => (
                <div
                  key={sale.id}
                  className="px-5 py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-mono font-semibold text-slate-900 dark:text-white">
                      {sale.receiptNumber} · {sale.nozzleCode}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 truncate">
                      {sale.paymentMode} {sale.vehicleNo ? `· ${sale.vehicleNo}` : ''} ·{' '}
                      {sale.soldTimeLabel}
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(sale.totalAmount)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formatLitres(sale.quantityLitres)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
