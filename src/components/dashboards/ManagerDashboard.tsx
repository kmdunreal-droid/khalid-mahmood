import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Fuel,
  Gauge,
  PackageCheck,
  Truck,
  Users,
  XCircle,
} from 'lucide-react';
import { ShiftWorkflowStatus } from '../../data/shiftTypes';
import { DashboardTelemetryState } from '../../hooks/useDashboardTelemetry';
import {
  computeShiftSummary,
  formatCurrency,
  formatLitres,
} from '../../utils/shiftMath';
import { ArchitectureTab } from '../OverviewSection';

interface ManagerDashboardProps {
  telemetry: DashboardTelemetryState;
  onNavigateTab: (tab: ArchitectureTab) => void;
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  telemetry,
  onNavigateTab,
}) => {
  const [shiftFilter, setShiftFilter] = useState<'ALL' | ShiftWorkflowStatus>('ALL');
  const [dispenserImgError, setDispenserImgError] = useState(false);

  const ops = useMemo(() => {
    const activeShift =
      telemetry.shifts.find((s) => s.status === 'OPEN') ?? telemetry.shifts[0];
    const activeSummary = activeShift ? computeShiftSummary(activeShift) : null;

    const postedSales = telemetry.sales.filter((s) => s.status === 'POSTED');
    const totalSalesAmount = postedSales.reduce((s, r) => s + r.totalAmount, 0);
    const totalLitresSold = postedSales.reduce((s, r) => s + r.quantityLitres, 0);

    const tenderTotals = {
      CASH: 0,
      UPI: 0,
      CARD: 0,
      CREDIT: 0,
    };
    postedSales.forEach((s) => {
      if (s.paymentMode === 'CASH') tenderTotals.CASH += s.totalAmount;
      else if (s.paymentMode === 'UPI') tenderTotals.UPI += s.totalAmount;
      else if (s.paymentMode === 'CARD') tenderTotals.CARD += s.totalAmount;
      else tenderTotals.CREDIT += s.totalAmount;
    });

    const operatorLeaderboard = new Map<
      string,
      { operatorName: string; litres: number; amount: number; txCount: number }
    >();
    postedSales.forEach((s) => {
      const existing = operatorLeaderboard.get(s.operatorName) ?? {
        operatorName: s.operatorName,
        litres: 0,
        amount: 0,
        txCount: 0,
      };
      existing.litres += s.quantityLitres;
      existing.amount += s.totalAmount;
      existing.txCount += 1;
      operatorLeaderboard.set(s.operatorName, existing);
    });

    const openPos = telemetry.purchaseOrders.filter(
      (po) => po.status === 'ORDERED' || po.status === 'PARTIAL'
    );
    const awaitingApprovalCount = telemetry.shifts.filter(
      (s) => s.status === 'HANDED_OVER'
    ).length;
    const lowStockCount = telemetry.tanks.filter(
      (t) => t.currentBookStockLitres <= t.minThresholdLitres * 1.25
    ).length;

    return {
      activeShift,
      activeSummary,
      totalSalesAmount,
      totalLitresSold,
      tenderTotals,
      leaderboard: Array.from(operatorLeaderboard.values()).sort(
        (a, b) => b.amount - a.amount
      ),
      openPos,
      awaitingApprovalCount,
      lowStockCount,
    };
  }, [telemetry]);

  const filteredShifts = telemetry.shifts.filter((s) =>
    shiftFilter === 'ALL' ? true : s.status === shiftFilter
  );

  return (
    <div className="space-y-6">
      {/* 2-Column Forecourt Operations Header */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Forecourt Operations Desk · {telemetry.stationName}
              </div>
              <h2 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight text-balance">
                Shift Supervision, Dip Audit & Tanker Intake
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Active Shift:{' '}
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {ops.activeShift?.shiftCode ?? 'N/A'}
                </span>{' '}
                · Window {ops.activeShift?.timeWindow ?? '06:00 – 18:00'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('shift_module')}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors whitespace-nowrap shrink-0"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>Open Shift Verification</span>
            </button>
          </div>

          {/* Live Payment Tender Mix Grid */}
          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Cash Drawer', value: ops.tenderTotals.CASH, color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Online / QR', value: ops.tenderTotals.UPI, color: 'text-blue-600 dark:text-blue-400' },
              { label: 'POS Cards', value: ops.tenderTotals.CARD, color: 'text-slate-800 dark:text-slate-100' },
              { label: 'Fleet Credit', value: ops.tenderTotals.CREDIT, color: 'text-amber-600 dark:text-amber-400' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3"
              >
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {item.label}
                </div>
                <div className={`mt-1 text-sm sm:text-base font-bold font-mono tabular-nums ${item.color}`}>
                  {formatCurrency(item.value)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Dispenser Bay Card */}
        <div className="lg:col-span-4 relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 min-h-[210px] flex flex-col justify-end">
          {!dispenserImgError ? (
            <img
              src="/src/assets/images/forecourt_dispenser_bay_1795435125492.jpg"
              alt="Multi-product petrol and diesel dispenser unit"
              referrerPolicy="no-referrer"
              onError={() => setDispenserImgError(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/45 to-transparent" />
          <div className="relative z-10 p-5">
            <div className="text-[11px] font-medium text-emerald-300">
              Hardware Status · 3 Islands Online
            </div>
            <div className="mt-1 text-base font-bold text-white">
              6 Active Nozzles Calibrated
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs font-mono tabular-nums text-slate-200">
              <span>Testing: {formatLitres(ops.activeSummary?.totalTestingLitres ?? 10)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Column Operational KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Shift Handovers Pending</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {ops.awaitingApprovalCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Requires manager count verification
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Daily Volume Dispensed</span>
            <Fuel className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatLitres(ops.totalLitresSold)}
          </div>
          <div className="mt-1 text-xs font-mono tabular-nums text-blue-600 dark:text-blue-400">
            {formatCurrency(ops.totalSalesAmount)} total collection
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Incoming Tanker POs</span>
            <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {ops.openPos.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {telemetry.deliveries.length} GRN receipts logged
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Low Stock Tank Alerts</span>
            <Gauge className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {ops.lowStockCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Out of {telemetry.tanks.length} underground tanks
          </div>
        </div>
      </section>

      {/* Main Operations Split: Shift Verification Queue + Stock & Attendant Performance */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Shift Handover Verification Queue */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Shift Handover & Cash Reconciliation
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verify bag seals, nozzle meters, and approve cash drops
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-x-auto">
              {(['ALL', 'OPEN', 'HANDED_OVER', 'APPROVED'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setShiftFilter(status)}
                  className={`min-h-[36px] px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                    shiftFilter === status
                      ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {status.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredShifts.map((shift) => {
              const summary = computeShiftSummary(shift);
              const canApprove = shift.status === 'HANDED_OVER' || shift.status === 'OPEN';
              return (
                <div key={shift.id} className="p-4 sm:px-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {shift.shiftCode}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600 dark:text-slate-300">
                          {shift.shiftType} ({shift.timeWindow})
                        </span>
                        <span className="text-slate-400">·</span>
                        <span
                          className={
                            shift.status === 'APPROVED'
                              ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                              : shift.status === 'HANDED_OVER'
                              ? 'font-semibold text-amber-600 dark:text-amber-400'
                              : shift.status === 'REJECTED'
                              ? 'font-semibold text-red-600 dark:text-red-400'
                              : 'font-semibold text-blue-600 dark:text-blue-400'
                          }
                        >
                          {shift.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Outgoing: {shift.handover.outgoingOperator} → Incoming:{' '}
                        {shift.handover.incomingOperator} · Seal{' '}
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {shift.handover.cashBagSealNo}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {canApprove && shift.status !== 'OPEN' && (
                        <>
                          <button
                            type="button"
                            disabled={telemetry.busyActionId === shift.id}
                            onClick={() =>
                              telemetry.reviewShiftHandover(
                                shift.id,
                                'APPROVED',
                                'Manager cash & meter verification passed.'
                              )
                            }
                            className="min-h-[44px] inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            disabled={telemetry.busyActionId === shift.id}
                            onClick={() =>
                              telemetry.reviewShiftHandover(
                                shift.id,
                                'REJECTED',
                                'Flagged for physical cash recount.'
                              )
                            }
                            className="min-h-[44px] inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors whitespace-nowrap"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Recount</span>
                          </button>
                        </>
                      )}
                      {shift.status === 'OPEN' && (
                        <button
                          type="button"
                          onClick={() => onNavigateTab('shift_module')}
                          className="min-h-[44px] inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
                        >
                          <span>Inspect Live Shift</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-2.5 text-xs font-mono tabular-nums">
                    <div>
                      <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400 block">
                        Meter Sales
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(summary.totalMeterSales)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400 block">
                        Cash Counted
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(summary.actualCashCollected)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400 block">
                        Variance
                      </span>
                      <span
                        className={`font-semibold ${
                          Math.abs(summary.cashVariance) <= 10
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {formatCurrency(summary.cashVariance)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Attendant Leaderboard & Incoming Tanker POs */}
        <div className="lg:col-span-5 space-y-5">
          {/* Operator Throughput */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Operator Shift Throughput
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('reports_module')}
                className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline"
              >
                Full Report
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-left">
                    <th className="py-2.5 px-4 font-medium">Attendant</th>
                    <th className="py-2.5 px-3 font-medium text-right">Volume</th>
                    <th className="py-2.5 px-4 font-medium text-right">Collection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                  {ops.leaderboard.map((row) => (
                    <tr
                      key={row.operatorName}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-2.5 px-4 font-sans font-medium text-slate-900 dark:text-slate-100">
                        {row.operatorName}
                        <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">
                          {row.txCount} receipts
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                        {formatLitres(row.litres)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Incoming Fuel POs & Tank Dip Alerts */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Tanker Intake & Stock Watch
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('purchase_module')}
                className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline"
              >
                Receive Tanker
              </button>
            </div>

            <div className="space-y-2.5">
              {ops.openPos.map((po) => (
                <div
                  key={po.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-mono font-semibold text-slate-900 dark:text-white">
                      {po.poNumber} · {po.primaryFuelGrade}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 truncate">
                      {po.supplierName} · ETA {po.expectedDeliveryDate}
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="font-semibold text-blue-700 dark:text-blue-400">
                      {po.totalOrderedLitres.toLocaleString('en-PK')} L
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {po.status}
                    </div>
                  </div>
                </div>
              ))}

              {telemetry.tanks
                .filter((t) => t.currentBookStockLitres <= t.minThresholdLitres * 1.25)
                .map((tank) => (
                  <div
                    key={tank.id}
                    className="rounded-lg border border-amber-300 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/25 p-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {tank.tankCode} Low Stock Watch
                        </div>
                        <div className="text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                          {formatLitres(tank.currentBookStockLitres)} remaining
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('stock_module')}
                      className="min-h-[36px] px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline shrink-0"
                    >
                      Dip Check
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
