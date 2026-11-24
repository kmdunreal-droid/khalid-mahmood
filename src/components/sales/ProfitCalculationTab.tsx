import React, { useMemo } from 'react';
import { Calculator, Download, RotateCcw, ShieldAlert } from 'lucide-react';
import { ActiveRolePersona } from '../../data/shiftTypes';
import {
  DispenserMachineSpec,
  ProfitAssumptions,
  SalesTransactionRecord,
} from '../../data/salesTypes';
import { formatCurrency, formatLitres } from '../../utils/shiftMath';

interface ProfitCalculationTabProps {
  machines: DispenserMachineSpec[];
  sales: SalesTransactionRecord[];
  assumptions: ProfitAssumptions;
  rolePersona: ActiveRolePersona;
  onUpdateAssumptions: (next: ProfitAssumptions) => void;
  onResetAssumptions: () => void;
}

const GRADE_LABELS: Record<string, string> = {
  'MS-91': 'Unleaded Petrol (MS)',
  'HSD-STD': 'High Speed Diesel (HSD)',
  'MS-95': 'Premium Petrol (XP95)',
};

export const ProfitCalculationTab: React.FC<ProfitCalculationTabProps> = ({
  machines,
  sales,
  assumptions,
  rolePersona,
  onUpdateAssumptions,
  onResetAssumptions,
}) => {
  const canEditCosts = rolePersona === 'OWNER';

  const postedSales = useMemo(
    () => sales.filter((s) => s.status === 'POSTED'),
    [sales]
  );

  const waterfall = useMemo(() => {
    let grossRevenue = 0;
    let totalCogs = 0;
    let totalLitres = 0;
    let onlineVolumeAmount = 0;

    for (const s of postedSales) {
      grossRevenue += s.totalAmount;
      totalLitres += s.quantityLitres;
      const costRate = assumptions.costByGrade[s.gradeCode] ?? s.unitCostPrice;
      totalCogs += costRate * s.quantityLitres;
      if (s.paymentMode === 'UPI' || s.paymentMode === 'CARD' || s.paymentMode === 'FLEET_CARD') {
        onlineVolumeAmount += s.totalAmount;
      }
    }

    const grossProfit = +(grossRevenue - totalCogs).toFixed(2);
    const grossMarginPct = grossRevenue > 0 ? +((grossProfit / grossRevenue) * 100).toFixed(2) : 0;
    const digitalMdrCost = +((onlineVolumeAmount * assumptions.onlineMdrPct) / 100).toFixed(2);
    const netOperatingProfit = +(
      grossProfit -
      digitalMdrCost -
      assumptions.dailyOperatingOverhead
    ).toFixed(2);
    const netMarginPct =
      grossRevenue > 0 ? +((netOperatingProfit / grossRevenue) * 100).toFixed(2) : 0;

    return {
      totalLitres: +totalLitres.toFixed(2),
      grossRevenue: +grossRevenue.toFixed(2),
      totalCogs: +totalCogs.toFixed(2),
      grossProfit,
      grossMarginPct,
      digitalMdrCost,
      netOperatingProfit,
      netMarginPct,
    };
  }, [postedSales, assumptions]);

  const gradeBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        gradeCode: string;
        productName: string;
        litres: number;
        revenue: number;
        cogs: number;
        grossProfit: number;
      }
    >();

    for (const s of postedSales) {
      const costRate = assumptions.costByGrade[s.gradeCode] ?? s.unitCostPrice;
      const existing = map.get(s.gradeCode) ?? {
        gradeCode: s.gradeCode,
        productName: GRADE_LABELS[s.gradeCode] ?? s.productName,
        litres: 0,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
      };
      existing.litres += s.quantityLitres;
      existing.revenue += s.totalAmount;
      existing.cogs += costRate * s.quantityLitres;
      existing.grossProfit = existing.revenue - existing.cogs;
      map.set(s.gradeCode, existing);
    }

    return Array.from(map.values()).map((row) => ({
      ...row,
      avgSellRate: row.litres > 0 ? +(row.revenue / row.litres).toFixed(2) : 0,
      landedCost: assumptions.costByGrade[row.gradeCode] ?? 0,
      profitSharePct:
        waterfall.grossProfit > 0
          ? +((row.grossProfit / waterfall.grossProfit) * 100).toFixed(1)
          : 0,
    }));
  }, [postedSales, assumptions, waterfall.grossProfit]);

  const machineProfitBreakdown = useMemo(() => {
    return machines.map((m) => {
      const mSales = postedSales.filter((s) => s.dispenserCode === m.dispenserCode);
      let litres = 0;
      let revenue = 0;
      let cogs = 0;
      for (const s of mSales) {
        const costRate = assumptions.costByGrade[s.gradeCode] ?? s.unitCostPrice;
        litres += s.quantityLitres;
        revenue += s.totalAmount;
        cogs += costRate * s.quantityLitres;
      }
      const grossProfit = +(revenue - cogs).toFixed(2);
      const marginPct = revenue > 0 ? +((grossProfit / revenue) * 100).toFixed(2) : 0;
      return {
        dispenserCode: m.dispenserCode,
        islandName: m.islandName,
        txCount: mSales.length,
        litres: +litres.toFixed(2),
        revenue: +revenue.toFixed(2),
        cogs: +cogs.toFixed(2),
        grossProfit,
        marginPct,
      };
    });
  }, [machines, postedSales, assumptions]);

  const handleExportProfitCsv = () => {
    const header = [
      'Grade Code',
      'Product',
      'Volume (L)',
      'Avg Sell Rate (PKR)',
      'Landed Cost (PKR)',
      'Gross Revenue (PKR)',
      'Landed COGS (PKR)',
      'Gross Profit (PKR)',
    ].join(',');
    const rows = gradeBreakdown.map((g) =>
      [
        g.gradeCode,
        `"${g.productName}"`,
        g.litres.toFixed(2),
        g.avgSellRate.toFixed(2),
        g.landedCost.toFixed(2),
        g.revenue.toFixed(2),
        g.cogs.toFixed(2),
        g.grossProfit.toFixed(2),
      ].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_profit_calculation_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (rolePersona === 'OPERATOR') {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center max-w-xl mx-auto space-y-3">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 mx-auto">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          Margin & Profit Analytics Restricted
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Landed fuel costs, MDR deductions, and net station profit calculations are visible only to{' '}
          <strong className="text-slate-900 dark:text-white">Owner</strong> and{' '}
          <strong className="text-slate-900 dark:text-white">Manager</strong> roles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Live Cost & Overhead Control Bar */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Automatic Profit Engine — Cost & Fee Inputs
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {canEditCosts
                  ? 'Adjust landed purchase costs, digital MDR %, or daily overhead to recalculate station margins live.'
                  : 'Manager Read-Only View · Cost assumptions are Owner-configured.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEditCosts && (
              <button
                type="button"
                onClick={onResetAssumptions}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportProfitCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {(['MS-91', 'HSD-STD', 'MS-95'] as const).map((code) => (
            <div key={code}>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                {code} Landed Cost (Rs./L)
              </label>
              <input
                type="number"
                min={0}
                step="0.05"
                disabled={!canEditCosts}
                value={assumptions.costByGrade[code] ?? 0}
                onChange={(e) =>
                  onUpdateAssumptions({
                    ...assumptions,
                    costByGrade: {
                      ...assumptions.costByGrade,
                      [code]: Math.max(0, Number(e.target.value) || 0),
                    },
                  })
                }
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800/60"
              />
            </div>
          ))}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
              Digital POS MDR (%)
            </label>
            <input
              type="number"
              min={0}
              max={5}
              step="0.05"
              disabled={!canEditCosts}
              value={assumptions.onlineMdrPct}
              onChange={(e) =>
                onUpdateAssumptions({
                  ...assumptions,
                  onlineMdrPct: Math.max(0, Number(e.target.value) || 0),
                })
              }
              className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800/60"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
              Daily Shift Overhead (Rs.)
            </label>
            <input
              type="number"
              min={0}
              step="100"
              disabled={!canEditCosts}
              value={assumptions.dailyOperatingOverhead}
              onChange={(e) =>
                onUpdateAssumptions({
                  ...assumptions,
                  dailyOperatingOverhead: Math.max(0, Number(e.target.value) || 0),
                })
              }
              className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800/60"
            />
          </div>
        </div>
      </section>

      {/* 4-Column Profit Waterfall */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">1. Gross Fuel Sales</div>
          <div className="mt-1 text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(waterfall.grossRevenue)}
          </div>
          <div className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {formatLitres(waterfall.totalLitres)} across {postedSales.length} receipts
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">2. Landed Fuel COGS</div>
          <div className="mt-1 text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(waterfall.totalCogs)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Depot purchase cost
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">3. Gross Margin Profit</div>
          <div className="mt-1 text-xl font-semibold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatCurrency(waterfall.grossProfit)}
          </div>
          <div className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {waterfall.grossMarginPct}% gross margin
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">4. Net Operating Profit</div>
          <div
            className={`mt-1 text-xl font-semibold font-mono tabular-nums ${
              waterfall.netOperatingProfit >= 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {formatCurrency(waterfall.netOperatingProfit)}
          </div>
          <div className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
            After MDR ({formatCurrency(waterfall.digitalMdrCost)}) & Overhead · {waterfall.netMarginPct}%
          </div>
        </div>
      </div>

      {/* Profit by Fuel Grade */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Automatic Profit by Fuel Grade
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Fuel Grade</th>
                <th className="py-2.5 px-4 text-right">Volume Sold</th>
                <th className="py-2.5 px-4 text-right">Retail Rate</th>
                <th className="py-2.5 px-4 text-right">Landed Cost</th>
                <th className="py-2.5 px-4 text-right">Dealer Spread</th>
                <th className="py-2.5 px-4 text-right">Gross Revenue</th>
                <th className="py-2.5 px-4 text-right">Gross Profit</th>
                <th className="py-2.5 px-4 text-right">Profit Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {gradeBreakdown.map((g) => (
                <tr key={g.gradeCode} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900 dark:text-white">{g.productName}</div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {g.gradeCode}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                    {formatLitres(g.litres)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    Rs. {g.avgSellRate.toFixed(2)}/L
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    Rs. {g.landedCost.toFixed(2)}/L
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-blue-600 dark:text-blue-400">
                    +Rs. {(g.avgSellRate - g.landedCost).toFixed(2)}/L
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(g.revenue)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(g.grossProfit)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {g.profitSharePct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Profit by Dispenser Machine */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Automatic Profit by Dispenser Machine
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Dispenser Machine</th>
                <th className="py-2.5 px-4 text-right">Receipts</th>
                <th className="py-2.5 px-4 text-right">Volume</th>
                <th className="py-2.5 px-4 text-right">Revenue</th>
                <th className="py-2.5 px-4 text-right">Landed COGS</th>
                <th className="py-2.5 px-4 text-right">Gross Profit</th>
                <th className="py-2.5 px-4 text-right">Gross Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {machineProfitBreakdown.map((m) => (
                <tr key={m.dispenserCode} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-mono font-semibold text-slate-900 dark:text-white">
                      {m.dispenserCode}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{m.islandName}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {m.txCount}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                    {formatLitres(m.litres)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(m.revenue)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {formatCurrency(m.cogs)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(m.grossProfit)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {m.marginPct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
