import React, { useMemo, useState } from 'react';
import { Fuel, Plus } from 'lucide-react';
import { ActiveRolePersona } from '../../data/shiftTypes';
import {
  DispenserMachineSpec,
  NozzleRateConfig,
  ProfitAssumptions,
  SalesTransactionRecord,
} from '../../data/salesTypes';
import { formatCurrency, formatLitres } from '../../utils/shiftMath';

interface MachineSalesTabProps {
  machines: DispenserMachineSpec[];
  nozzles: NozzleRateConfig[];
  sales: SalesTransactionRecord[];
  profitAssumptions: ProfitAssumptions;
  rolePersona: ActiveRolePersona;
  onQuickSaleForMachine: (dispenserCode: string) => void;
}

export const MachineSalesTab: React.FC<MachineSalesTabProps> = ({
  machines,
  nozzles,
  sales,
  profitAssumptions,
  rolePersona,
  onQuickSaleForMachine,
}) => {
  const [selectedMachineCode, setSelectedMachineCode] = useState<string>('ALL');
  const canViewProfit = rolePersona === 'OWNER' || rolePersona === 'MANAGER';

  const machineStats = useMemo(() => {
    return machines.map((m) => {
      const mSales = sales.filter(
        (s) => s.status === 'POSTED' && s.dispenserCode === m.dispenserCode
      );
      let litres = 0;
      let revenue = 0;
      let cashAmount = 0;
      let onlineAmount = 0;
      let creditAmount = 0;
      let profit = 0;

      for (const s of mSales) {
        litres += s.quantityLitres;
        revenue += s.totalAmount;
        const unitCost = profitAssumptions.costByGrade[s.gradeCode] ?? s.unitCostPrice;
        profit += (s.unitSellingPrice - unitCost) * s.quantityLitres;

        if (s.paymentMode === 'CASH') cashAmount += s.totalAmount;
        else if (s.paymentMode === 'CREDIT') creditAmount += s.totalAmount;
        else onlineAmount += s.totalAmount;
      }

      const assignedNozzles = nozzles.filter((n) => n.dispenserCode === m.dispenserCode);
      const marginPct = revenue > 0 ? +((profit / revenue) * 100).toFixed(2) : 0;

      return {
        machine: m,
        assignedNozzles,
        txCount: mSales.length,
        litres: +litres.toFixed(2),
        revenue: +revenue.toFixed(2),
        cashAmount: +cashAmount.toFixed(2),
        onlineAmount: +onlineAmount.toFixed(2),
        creditAmount: +creditAmount.toFixed(2),
        profit: +profit.toFixed(2),
        marginPct,
      };
    });
  }, [machines, nozzles, sales, profitAssumptions]);

  const filteredTransactions = useMemo(() => {
    return sales.filter(
      (s) =>
        s.status === 'POSTED' &&
        (selectedMachineCode === 'ALL' || s.dispenserCode === selectedMachineCode)
    );
  }, [sales, selectedMachineCode]);

  const totalStationRevenue = machineStats.reduce((sum, m) => sum + m.revenue, 0);

  return (
    <div className="space-y-5">
      {/* Machine Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {machineStats.map((row) => {
          const sharePct =
            totalStationRevenue > 0 ? Math.round((row.revenue / totalStationRevenue) * 100) : 0;
          const isSelected = selectedMachineCode === row.machine.dispenserCode;

          return (
            <div
              key={row.machine.dispenserCode}
              className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 space-y-4 transition-colors ${
                isSelected
                  ? 'border-blue-600 dark:border-blue-500 ring-1 ring-blue-600/20 dark:ring-blue-500/20'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {row.machine.dispenserCode} · {row.machine.status}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                    {row.machine.islandName}
                  </h3>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {row.machine.hardwareModel}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onQuickSaleForMachine(row.machine.dispenserCode)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Sale</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Machine Revenue</div>
                  <div className="text-base font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(row.revenue)}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {sharePct}% of forecourt
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Volume Dispensed</div>
                  <div className="text-base font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatLitres(row.litres)}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {row.txCount} receipts
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Cash / Online / Credit</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-200">
                    {formatCurrency(row.cashAmount)} · {formatCurrency(row.onlineAmount)} ·{' '}
                    {formatCurrency(row.creditAmount)}
                  </span>
                </div>
                {canViewProfit && (
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span>Auto Gross Profit</span>
                    <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(row.profit)} ({row.marginPct}%)
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  Nozzles: {row.assignedNozzles.map((n) => n.nozzleCode).join(', ')}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedMachineCode(isSelected ? 'ALL' : row.machine.dispenserCode)
                  }
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                >
                  {isSelected ? 'Show All Machines' : 'Filter Ledger'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Machine Summary & Filtered Receipts Table */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Fuel className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Machine-wise Transactions
              {selectedMachineCode !== 'ALL' ? ` · ${selectedMachineCode}` : ''}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['ALL', ...machines.map((m) => m.dispenserCode)] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setSelectedMachineCode(code)}
                className={`px-3 py-1.5 text-[11px] font-medium rounded-xl transition-colors whitespace-nowrap ${
                  selectedMachineCode === code
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {code === 'ALL' ? 'All Machines' : code}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Receipt & Time</th>
                <th className="py-2.5 px-4">Machine / Nozzle</th>
                <th className="py-2.5 px-4">Fuel Grade</th>
                <th className="py-2.5 px-4">Payment Mode</th>
                <th className="py-2.5 px-4 text-right">Volume</th>
                <th className="py-2.5 px-4 text-right">Total Sale</th>
                {canViewProfit && <th className="py-2.5 px-4 text-right">Auto Profit</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {filteredTransactions.map((s) => {
                const unitCost = profitAssumptions.costByGrade[s.gradeCode] ?? s.unitCostPrice;
                const liveProfit = +((s.unitSellingPrice - unitCost) * s.quantityLitres).toFixed(2);
                const modeLabel = s.paymentMode === 'UPI' ? 'ONLINE / QR' : s.paymentMode;
                return (
                  <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 font-mono">
                      <div className="font-semibold text-slate-900 dark:text-white">{s.receiptNumber}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {s.soldDate} · {s.soldTimeLabel}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-mono font-medium text-slate-900 dark:text-white">
                        {s.dispenserCode} · {s.nozzleCode}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{s.operatorName}</div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-800 dark:text-slate-200">{s.productName}</td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900 dark:text-white">{modeLabel}</div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {s.customerName || s.vehicleNo || s.paymentReference || 'Walk-in Retail'}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {formatLitres(s.quantityLitres)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(s.totalAmount)}
                    </td>
                    {canViewProfit && (
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(liveProfit)}
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td
                    colSpan={canViewProfit ? 7 : 6}
                    className="py-8 text-center text-xs text-slate-500 dark:text-slate-400"
                  >
                    No posted sales transactions for this dispenser machine.
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
