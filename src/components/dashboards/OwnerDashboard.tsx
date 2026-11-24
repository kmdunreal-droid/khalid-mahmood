import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  FileBarChart2,
  Fuel,
  Gauge,
  Landmark,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import { EXPENSE_CATEGORY_LABELS } from '../../data/accountingSeedData';
import { DashboardTelemetryState } from '../../hooks/useDashboardTelemetry';
import { computeBookLedger, computeProfitAndLoss } from '../../utils/accountingMath';
import {
  computeShiftSummary,
  formatCurrency,
  formatLitres,
} from '../../utils/shiftMath';
import { ArchitectureTab } from '../OverviewSection';

interface OwnerDashboardProps {
  telemetry: DashboardTelemetryState;
  onNavigateTab: (tab: ArchitectureTab) => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  telemetry,
  onNavigateTab,
}) => {
  const [canopyImgError, setCanopyImgError] = useState(false);

  const metrics = useMemo(() => {
    const activeSales = telemetry.sales.filter((s) => s.status === 'POSTED');
    const dailyRevenue = activeSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const dailyLitres = activeSales.reduce((sum, s) => sum + s.quantityLitres, 0);
    const dailyGrossMargin = activeSales.reduce((sum, s) => sum + s.grossProfit, 0);

    const petrolLitres = activeSales
      .filter((s) => s.gradeCode.startsWith('MS'))
      .reduce((sum, s) => sum + s.quantityLitres, 0);
    const dieselLitres = activeSales
      .filter((s) => s.gradeCode.startsWith('HSD'))
      .reduce((sum, s) => sum + s.quantityLitres, 0);

    const cashBook = computeBookLedger(telemetry.accountingTransactions, 'CASH');
    const bankBook = computeBookLedger(telemetry.accountingTransactions, 'BANK');
    const pnlMonth = computeProfitAndLoss(
      telemetry.accountingTransactions,
      'MONTH',
      EXPENSE_CATEGORY_LABELS
    );

    const pendingExpenses = telemetry.accountingTransactions.filter(
      (t) =>
        t.entryCategory === 'OPERATING_EXPENSE' &&
        t.approvalStatus === 'PENDING_OWNER'
    );
    const unreadAlerts = telemetry.notifications.filter((n) => !n.isRead);
    const shiftsNeedingReview = telemetry.shifts.filter(
      (s) => s.status === 'HANDED_OVER'
    );

    const lowTanks = telemetry.tanks.filter(
      (t) => t.currentBookStockLitres <= t.minThresholdLitres * 1.25
    );
    const totalPayables = telemetry.suppliers.reduce(
      (sum, s) => sum + s.outstandingBalance,
      0
    );
    const totalReceivables = telemetry.creditCustomers.reduce(
      (sum, c) => sum + c.currentBalance,
      0
    );

    return {
      dailyRevenue,
      dailyLitres,
      dailyGrossMargin,
      petrolLitres,
      dieselLitres,
      cashBalance: cashBook.closingBalance,
      bankBalance: bankBook.closingBalance,
      pnlMonth,
      pendingExpenses,
      unreadAlerts,
      shiftsNeedingReview,
      lowTanks,
      totalPayables,
      totalReceivables,
      pendingActionCount:
        pendingExpenses.length + unreadAlerts.length + shiftsNeedingReview.length,
    };
  }, [telemetry]);

  const petrolSharePct =
    metrics.dailyLitres > 0
      ? Math.round((metrics.petrolLitres / metrics.dailyLitres) * 100)
      : 42;
  const dieselSharePct = Math.max(0, 100 - petrolSharePct);

  return (
    <div className="space-y-6">
      {/* 2-Column Executive Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Flagship Station Canopy Visual + Liquidity Summary */}
        <div className="lg:col-span-7 relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 min-h-[240px] flex flex-col justify-between">
          {!canopyImgError ? (
            <img
              src="/src/assets/images/station_canopy_night_1795435125741.jpg"
              alt="Highway Meridian Fuels forecourt canopy at twilight"
              referrerPolicy="no-referrer"
              onError={() => setCanopyImgError(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-900 to-emerald-950" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/65 to-slate-950/30" />

          <div className="relative z-10 p-5 sm:p-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-emerald-300">
                Executive Command · {telemetry.stationId}
              </p>
              <h2 className="mt-1 text-xl sm:text-2xl font-bold text-white tracking-tight text-balance">
                {telemetry.stationName}
              </h2>
              <p className="mt-1 text-xs text-slate-300">
                Multi-shift treasury, tank reserves, and OMC payable oversight
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('reports_module')}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap shrink-0"
            >
              <FileBarChart2 className="w-4 h-4" />
              <span>Export Profit Report</span>
            </button>
          </div>

          <div className="relative z-10 p-5 sm:p-6 pt-0 grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-white/10 mt-auto bg-slate-950/55 backdrop-blur-sm">
            <div>
              <div className="text-[11px] text-slate-300">Bank Current Account</div>
              <div className="mt-0.5 text-base sm:text-lg font-bold font-mono tabular-nums text-white">
                {formatCurrency(metrics.bankBalance)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-300">Cash Chest Balance</div>
              <div className="mt-0.5 text-base sm:text-lg font-bold font-mono tabular-nums text-emerald-300">
                {formatCurrency(metrics.cashBalance)}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="text-[11px] text-slate-300">Fleet Receivables vs OMC Due</div>
              <div className="mt-0.5 text-xs sm:text-sm font-mono tabular-nums text-blue-200">
                +{formatCurrency(metrics.totalReceivables)} / -{formatCurrency(metrics.totalPayables)}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Monthly P&L + Fuel Mix Margin Anchor */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                Monthly Operating Margin
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {metrics.pnlMonth.periodLabel}
              </span>
            </div>

            <div className="mt-3 flex items-baseline justify-between gap-4">
              <div>
                <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {formatCurrency(metrics.pnlMonth.netOperatingProfit)}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Net Profit after Rs. {Math.round(metrics.pnlMonth.totalExpenses).toLocaleString('en-PK')} operating expenses
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {metrics.pnlMonth.netMarginPct.toFixed(2)}%
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Net Margin
                </div>
              </div>
            </div>

            {/* Fuel Grade Volume Mix Bar (Blue + Green) */}
            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Forecourt Fuel Volume Mix
                </span>
                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {formatLitres(metrics.dailyLitres)} today
                </span>
              </div>
              <div className="h-2.5 w-full rounded-sm overflow-hidden bg-slate-100 dark:bg-slate-800 flex">
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{ width: `${petrolSharePct}%` }}
                  title={`Petrol ${petrolSharePct}%`}
                />
                <div
                  className="bg-blue-600 h-full transition-all"
                  style={{ width: `${dieselSharePct}%` }}
                  title={`Diesel ${dieselSharePct}%`}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-emerald-700 dark:text-emerald-400">
                  Petrol (MS/XP95): {petrolSharePct}% · {formatLitres(metrics.petrolLitres)}
                </span>
                <span className="text-blue-700 dark:text-blue-400">
                  Diesel (HSD): {dieselSharePct}% · {formatLitres(metrics.dieselLitres)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Gross Profit Margin: <strong className="font-mono text-slate-900 dark:text-white">{metrics.pnlMonth.grossMarginPct.toFixed(1)}%</strong>
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('accounting_module')}
              className="font-semibold text-blue-600 dark:text-emerald-400 hover:underline whitespace-nowrap"
            >
              View Accounts →
            </button>
          </div>
        </div>
      </section>

      {/* 4-Column Responsive KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Today Forecourt Sales</span>
            <Fuel className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(metrics.dailyRevenue)}
          </div>
          <div className="mt-1 text-xs font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            +{formatCurrency(metrics.dailyGrossMargin)} dealer margin
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Monthly Gross Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(metrics.pnlMonth.totalRevenue)}
          </div>
          <div className="mt-1 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Gross margin {metrics.pnlMonth.grossMarginPct.toFixed(2)}%
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>OMC Supplier Payables</span>
            <Landmark className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(metrics.totalPayables)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {telemetry.invoices.filter((i) => i.paymentStatus !== 'PAID').length} open tax invoices
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Owner Sign-Off Queue</span>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {metrics.pendingActionCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {metrics.lowTanks.length} tank alerts · {metrics.pendingExpenses.length} expense approvals
          </div>
        </div>
      </section>

      {/* Main Executive Work Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Owner Exception Alerts & Voucher Approvals */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Owner Action & Exception Queue
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                High-value expense vouchers, variance flags, and shift handover sign-offs
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('shift_module')}
              className="min-h-[40px] inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              <span>Shift Desk</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {metrics.pendingExpenses.map((tx) => (
              <div
                key={tx.id}
                className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Pending Expense Approval · {tx.voucherNo}</span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {tx.partyOrVendor} — {tx.accountName}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {formatCurrency(tx.amount)} · {tx.txDate} · {tx.paymentMode}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={telemetry.busyActionId === tx.id}
                  onClick={() => telemetry.approvePendingExpense(tx.id)}
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors whitespace-nowrap shrink-0"
                >
                  {telemetry.busyActionId === tx.id ? 'Approving...' : 'Approve Voucher'}
                </button>
              </div>
            ))}

            {telemetry.notifications.map((noti) => (
              <div
                key={noti.id}
                className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={
                        noti.severity === 'CRITICAL'
                          ? 'font-semibold text-red-600 dark:text-red-400'
                          : noti.severity === 'WARNING'
                          ? 'font-semibold text-amber-600 dark:text-amber-400'
                          : 'font-semibold text-blue-600 dark:text-blue-400'
                      }
                    >
                      {noti.severity}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      {noti.shiftCode}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {noti.isRead ? 'Acknowledged' : 'Unread'}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {noti.title}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {noti.message}
                  </div>
                </div>
                {!noti.isRead && (
                  <button
                    type="button"
                    disabled={telemetry.busyActionId === noti.id}
                    onClick={() => telemetry.acknowledgeNotification(noti.id)}
                    className="min-h-[44px] px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            ))}

            {metrics.pendingExpenses.length === 0 &&
              telemetry.notifications.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                  All station alerts and owner approvals are clear.
                </div>
              )}
          </div>
        </div>

        {/* Underground Tank Reserves + Shift Audit Summary */}
        <div className="lg:col-span-5 space-y-5">
          {/* Underground Tank Inventory */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Underground Tank Reserves
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Book stock vs reorder threshold
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('stock_module')}
                className="min-h-[40px] inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>Stock Dip Log</span>
              </button>
            </div>

            <div className="space-y-4">
              {telemetry.tanks.map((tank) => {
                const fillPct = Math.min(
                  100,
                  Math.round(
                    (tank.currentBookStockLitres / Math.max(1, tank.capacityLitres)) * 100
                  )
                );
                const isLow = tank.currentBookStockLitres <= tank.minThresholdLitres;
                const isPetrol = tank.fuelFamily === 'PETROL';
                return (
                  <div key={tank.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="font-medium text-slate-800 dark:text-slate-100 truncate">
                        {tank.tankCode} · {tank.productName}
                      </div>
                      <div className="font-mono tabular-nums shrink-0 text-slate-600 dark:text-slate-300">
                        {formatLitres(tank.currentBookStockLitres)} ({fillPct}%)
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          isLow
                            ? 'bg-amber-500'
                            : isPetrol
                            ? 'bg-emerald-500'
                            : 'bg-blue-600'
                        }`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      <span>
                        {isLow ? 'Low Stock Warning' : 'Nominal Reserve'} · Threshold{' '}
                        {tank.minThresholdLitres.toLocaleString('en-PK')} L
                      </span>
                      <span>Density {tank.densityAt15C.toFixed(3)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shift Cash Reconciliation Watch */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Shift Cash Audit
                </h3>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {telemetry.shifts.length} shifts tracked
              </span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {telemetry.shifts.map((shift) => {
                const summary = computeShiftSummary(shift);
                const varianceZero = Math.abs(summary.cashVariance) <= 10;
                return (
                  <div
                    key={shift.id}
                    className="px-5 py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {shift.shiftCode}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {shift.shiftType} · {shift.status}
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums shrink-0">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(summary.actualCashCollected)}
                      </div>
                      <div
                        className={
                          varianceZero
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }
                      >
                        Var: {formatCurrency(summary.cashVariance)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
