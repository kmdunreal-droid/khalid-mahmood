import React, { useMemo, useState } from 'react';
import { Gauge, Plus } from 'lucide-react';
import { ActiveRolePersona } from '../../data/shiftTypes';
import {
  NozzleRateConfig,
  ProfitAssumptions,
  SalesTransactionRecord,
} from '../../data/salesTypes';
import { formatCurrency, formatLitres } from '../../utils/shiftMath';

interface NozzleSalesTabProps {
  nozzles: NozzleRateConfig[];
  sales: SalesTransactionRecord[];
  profitAssumptions: ProfitAssumptions;
  rolePersona: ActiveRolePersona;
  onQuickSaleForNozzle: (nozzleCode: string) => void;
}

export const NozzleSalesTab: React.FC<NozzleSalesTabProps> = ({
  nozzles,
  sales,
  profitAssumptions,
  rolePersona,
  onQuickSaleForNozzle,
}) => {
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [machineFilter, setMachineFilter] = useState<string>('ALL');
  const canViewProfit = rolePersona === 'OWNER' || rolePersona === 'MANAGER';

  const nozzleRows = useMemo(() => {
    return nozzles
      .filter((n) => {
        if (gradeFilter !== 'ALL' && n.gradeCode !== gradeFilter) return false;
        if (machineFilter !== 'ALL' && n.dispenserCode !== machineFilter) return false;
        return true;
      })
      .map((n) => {
        const nSales = sales.filter(
          (s) => s.status === 'POSTED' && s.nozzleCode === n.nozzleCode
        );
        let litresSold = 0;
        let revenue = 0;
        let cashRev = 0;
        let onlineRev = 0;
        let creditRev = 0;
        let profit = 0;

        const landedCost = profitAssumptions.costByGrade[n.gradeCode] ?? n.unitCostPrice;

        for (const s of nSales) {
          litresSold += s.quantityLitres;
          revenue += s.totalAmount;
          profit += (s.unitSellingPrice - landedCost) * s.quantityLitres;
          if (s.paymentMode === 'CASH') cashRev += s.totalAmount;
          else if (s.paymentMode === 'CREDIT') creditRev += s.totalAmount;
          else onlineRev += s.totalAmount;
        }

        const closingMeter = +(n.openingMeter + litresSold).toFixed(2);
        const unitMargin = +(n.unitSellingPrice - landedCost).toFixed(2);
        const marginPct = revenue > 0 ? +((profit / revenue) * 100).toFixed(2) : 0;

        return {
          nozzle: n,
          landedCost,
          unitMargin,
          closingMeter,
          txCount: nSales.length,
          litresSold: +litresSold.toFixed(2),
          revenue: +revenue.toFixed(2),
          cashRev: +cashRev.toFixed(2),
          onlineRev: +onlineRev.toFixed(2),
          creditRev: +creditRev.toFixed(2),
          profit: +profit.toFixed(2),
          marginPct,
        };
      });
  }, [nozzles, sales, profitAssumptions, gradeFilter, machineFilter]);

  const totals = useMemo(() => {
    return nozzleRows.reduce(
      (acc, r) => ({
        litres: +(acc.litres + r.litresSold).toFixed(2),
        revenue: +(acc.revenue + r.revenue).toFixed(2),
        profit: +(acc.profit + r.profit).toFixed(2),
        txCount: acc.txCount + r.txCount,
      }),
      { litres: 0, revenue: 0, profit: 0, txCount: 0 }
    );
  }, [nozzleRows]);

  return (
    <div className="space-y-5">
      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">Grade:</span>
            {(['ALL', 'MS-91', 'HSD-STD', 'MS-95'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGradeFilter(g)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors whitespace-nowrap ${
                  gradeFilter === g
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {g === 'ALL' ? 'All Grades' : g}
              </button>
            ))}
          </div>

          <select
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="ALL">All Dispenser Machines</option>
            <option value="MPD-01">MPD-01 (Island A)</option>
            <option value="MPD-02">MPD-02 (Island B)</option>
            <option value="MPD-03">MPD-03 (Island C)</option>
          </select>
        </div>

        <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
          {nozzleRows.length} nozzles · {formatLitres(totals.litres)} · {formatCurrency(totals.revenue)}
        </div>
      </div>

      {/* Nozzle Performance Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <Gauge className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Nozzle-wise Meter Throughput & Profit
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Nozzle / Machine</th>
                <th className="py-2.5 px-4">Product & Attendant</th>
                <th className="py-2.5 px-4 text-right">Opening → Closing Meter</th>
                <th className="py-2.5 px-4 text-right">Sold Qty</th>
                <th className="py-2.5 px-4 text-right">
                  {canViewProfit ? 'Sell / Cost (Rs./L)' : 'Retail Rate'}
                </th>
                <th className="py-2.5 px-4 text-right">Gross Revenue</th>
                {canViewProfit && <th className="py-2.5 px-4 text-right">Auto Profit</th>}
                <th className="py-2.5 px-4 text-right">POS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {nozzleRows.map((r) => (
                <tr
                  key={r.nozzle.nozzleCode}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-4 align-top">
                    <div className="font-mono font-semibold text-slate-900 dark:text-white">
                      {r.nozzle.nozzleCode}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                      {r.nozzle.dispenserCode} · {r.txCount} txns
                    </div>
                  </td>
                  <td className="py-3 px-4 align-top">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {r.nozzle.productName}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Operator: {r.nozzle.operatorName}
                    </div>
                  </td>
                  <td className="py-3 px-4 align-top text-right font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-400">
                    <div>{r.nozzle.openingMeter.toFixed(2)}</div>
                    <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                      {r.closingMeter.toFixed(2)}
                    </div>
                  </td>
                  <td className="py-3 px-4 align-top text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {formatLitres(r.litresSold)}
                  </td>
                  <td className="py-3 px-4 align-top text-right font-mono tabular-nums">
                    <div className="text-slate-900 dark:text-white">
                      Rs. {r.nozzle.unitSellingPrice.toFixed(2)}
                    </div>
                    {canViewProfit && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Cost Rs. {r.landedCost.toFixed(2)} (+Rs. {r.unitMargin.toFixed(2)}/L)
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 align-top text-right font-mono tabular-nums">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(r.revenue)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      C:{formatCurrency(r.cashRev)} · O:{formatCurrency(r.onlineRev)}
                    </div>
                  </td>
                  {canViewProfit && (
                    <td className="py-3 px-4 align-top text-right font-mono tabular-nums">
                      <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(r.profit)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {r.marginPct}% margin
                      </div>
                    </td>
                  )}
                  <td className="py-3 px-4 align-top text-right">
                    <button
                      type="button"
                      onClick={() => onQuickSaleForNozzle(r.nozzle.nozzleCode)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors whitespace-nowrap"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Bill</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs font-semibold">
                <td colSpan={3} className="py-3 px-4 text-slate-700 dark:text-slate-300">
                  Total Across Filtered Nozzles ({nozzleRows.length})
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                  {formatLitres(totals.litres)}
                </td>
                <td className="py-3 px-4" />
                <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                  {formatCurrency(totals.revenue)}
                </td>
                {canViewProfit && (
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(totals.profit)}
                  </td>
                )}
                <td className="py-3 px-4" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
