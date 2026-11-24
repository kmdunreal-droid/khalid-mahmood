import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Lock,
  Scale,
} from 'lucide-react';
import { EXPENSE_CATEGORY_LABELS } from '../../data/accountingSeedData';
import { AccountingTransactionRecord } from '../../data/accountingTypes';
import { SupplierRecord } from '../../data/purchaseTypes';
import { CreditCustomerAccount } from '../../data/salesTypes';
import { ActiveRolePersona } from '../../data/shiftTypes';
import {
  computeBalanceSheet,
  computeProfitAndLoss,
} from '../../utils/accountingMath';
import { formatCurrency } from '../../utils/shiftMath';

interface FinancialStatementsTabProps {
  statementMode: 'PL' | 'BS';
  rolePersona: ActiveRolePersona;
  transactions: AccountingTransactionRecord[];
  customers: CreditCustomerAccount[];
  suppliers: SupplierRecord[];
}

export const FinancialStatementsTab: React.FC<FinancialStatementsTabProps> = ({
  statementMode,
  rolePersona,
  transactions,
  customers,
  suppliers,
}) => {
  const [period, setPeriod] = useState<'MONTH' | 'YTD'>('MONTH');

  const pl = useMemo(
    () => computeProfitAndLoss(transactions, period, EXPENSE_CATEGORY_LABELS),
    [transactions, period]
  );

  const bs = useMemo(
    () =>
      computeBalanceSheet(
        transactions,
        customers,
        suppliers,
        pl.netOperatingProfit
      ),
    [transactions, customers, suppliers, pl.netOperatingProfit]
  );

  if (rolePersona !== 'OWNER') {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3 max-w-xl mx-auto">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mx-auto">
          <Lock className="w-5 h-5" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          {statementMode === 'PL' ? 'Profit & Loss Statement' : 'Balance Sheet'} Restricted to Station Owner
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
          Procurement margins, operating profit & loss schedules, and Balance Sheet equity statements are available only to Owner accounts.
        </p>
      </div>
    );
  }

  const handleExportStatement = () => {
    const lines: string[] = [];
    if (statementMode === 'PL') {
      lines.push(`Statement,Profit & Loss (${pl.periodLabel})`);
      lines.push('Section,Line Item,Amount (PKR)');
      pl.revenueLines.forEach((l) => lines.push(`Revenue,"${l.label}",${l.amount.toFixed(2)}`));
      lines.push(`Revenue,Total Operating Revenue,${pl.totalRevenue.toFixed(2)}`);
      pl.cogsLines.forEach((l) => lines.push(`COGS,"${l.label}",${l.amount.toFixed(2)}`));
      lines.push(`COGS,Total Cost of Goods Sold,${pl.totalCogs.toFixed(2)}`);
      lines.push(`Margin,Gross Profit (${pl.grossMarginPct}%),${pl.grossProfit.toFixed(2)}`);
      pl.expenseLines.forEach((l) => lines.push(`OpEx,"${l.label}",${l.amount.toFixed(2)}`));
      lines.push(`OpEx,Total Operating Expenses,${pl.totalExpenses.toFixed(2)}`);
      lines.push(`Bottom Line,Net Operating Profit (${pl.netMarginPct}%),${pl.netOperatingProfit.toFixed(2)}`);
    } else {
      lines.push(`Statement,Balance Sheet As Of ${bs.asOfDate}`);
      lines.push('Group,Account,Amount (PKR)');
      bs.currentAssets.forEach((l) => lines.push(`Current Assets,"${l.label}",${l.amount.toFixed(2)}`));
      bs.fixedAssets.forEach((l) => lines.push(`Fixed Assets,"${l.label}",${l.amount.toFixed(2)}`));
      lines.push(`Total Assets,Total Assets,${bs.totalAssets.toFixed(2)}`);
      bs.currentLiabilities.forEach((l) =>
        lines.push(`Current Liabilities,"${l.label}",${l.amount.toFixed(2)}`)
      );
      bs.equityItems.forEach((l) => lines.push(`Owner Equity,"${l.label}",${l.amount.toFixed(2)}`));
      lines.push(
        `Total Liabilities & Equity,Total Liabilities & Equity,${bs.totalLiabilitiesAndEquity.toFixed(2)}`
      );
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      statementMode === 'PL' ? 'station_profit_and_loss.csv' : 'station_balance_sheet.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (statementMode === 'PL') {
    return (
      <div className="space-y-5">
        {/* P&L KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Gross Fuel & Lube Revenue</div>
            <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
              {formatCurrency(pl.totalRevenue)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{pl.periodLabel}</div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Gross Profit (Dealer Margin)</div>
            <div className="text-lg font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-1">
              {formatCurrency(pl.grossProfit)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
              Gross Margin: {pl.grossMarginPct}%
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Operating Expenses (OpEx)</div>
            <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
              {formatCurrency(pl.totalExpenses)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Includes live station expenses ledger
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Net Operating Profit (EBITDA)</div>
            <div
              className={`text-lg font-bold font-mono tabular-nums mt-1 ${
                pl.netOperatingProfit >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-red-700 dark:text-red-400'
              }`}
            >
              {formatCurrency(pl.netOperatingProfit)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
              Net Margin: {pl.netMarginPct}%
            </div>
          </div>
        </div>

        {/* Income Statement Schedule */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Statement of Profit & Loss · {pl.periodLabel}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Combines fuel grade margins with live operating expense postings.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                {(
                  [
                    { id: 'MONTH', label: 'Nov 2026' },
                    { id: 'YTD', label: 'FY 2026-27 YTD' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPeriod(opt.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      period === opt.id
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleExportStatement}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
            {/* Revenue Section */}
            <div className="p-5 space-y-2">
              <div className="font-semibold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                1. Operating Revenue
              </div>
              {pl.revenueLines.map((line) => (
                <div key={line.label} className="flex items-center justify-between py-1">
                  <span className="text-slate-700 dark:text-slate-300">{line.label}</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(line.amount)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 font-semibold text-slate-900 dark:text-white">
                <span>Total Operating Revenue</span>
                <span className="font-mono tabular-nums">{formatCurrency(pl.totalRevenue)}</span>
              </div>
            </div>

            {/* COGS & Gross Profit */}
            <div className="p-5 space-y-2">
              <div className="font-semibold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                2. Cost of Goods Sold (Fuel Procurement)
              </div>
              {pl.cogsLines.map((line) => (
                <div key={line.label} className="flex items-center justify-between py-1">
                  <span className="text-slate-700 dark:text-slate-300">{line.label}</span>
                  <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                    {formatCurrency(line.amount)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 font-semibold text-slate-900 dark:text-white">
                <span>Total Cost of Goods Sold</span>
                <span className="font-mono tabular-nums">{formatCurrency(pl.totalCogs)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200 dark:border-slate-800 text-sm font-bold text-blue-700 dark:text-blue-400">
                <span>Gross Profit ({pl.grossMarginPct}% Margin)</span>
                <span className="font-mono tabular-nums">{formatCurrency(pl.grossProfit)}</span>
              </div>
            </div>

            {/* Operating Expenses */}
            <div className="p-5 space-y-2">
              <div className="font-semibold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                3. Station Operating Expenses
              </div>
              {pl.expenseLines.map((line) => (
                <div key={line.category} className="flex items-center justify-between py-1">
                  <span className="text-slate-700 dark:text-slate-300">{line.label}</span>
                  <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                    {formatCurrency(line.amount)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 font-semibold text-slate-900 dark:text-white">
                <span>Total Operating Expenses</span>
                <span className="font-mono tabular-nums">{formatCurrency(pl.totalExpenses)}</span>
              </div>
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-300 dark:border-slate-700 text-base font-bold text-emerald-700 dark:text-emerald-400">
                <span>Net Operating Profit ({pl.netMarginPct}% Net Margin)</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(pl.netOperatingProfit)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Balance Sheet Top Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Current Assets</div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {formatCurrency(bs.totalCurrentAssets)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Cash, Bank, Debtors & Fuel Stock
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Assets</div>
          <div className="text-lg font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            {formatCurrency(bs.totalAssets)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Current + Net Fixed Infrastructure
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Liabilities</div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {formatCurrency(bs.totalLiabilities)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Supplier Payables & Statutory Dues
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Owner&apos;s Equity</div>
          <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
            {formatCurrency(bs.totalEquity)}
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1 mt-0.5 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Balanced · Diff {formatCurrency(bs.balanceDifference)}
          </div>
        </div>
      </div>

      {/* Balance Sheet 2-Column Schedule */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Balance Sheet · As of {bs.asOfDate}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Reconciled from Cash Book, Bank Book, Customer Debtors, Supplier Creditors & Fuel Stock.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportStatement}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 text-xs">
          {/* Assets Side */}
          <div className="p-5 space-y-5">
            <div className="space-y-2">
              <div className="font-semibold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                Current Assets
              </div>
              {bs.currentAssets.map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1">
                  <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 font-semibold text-slate-900 dark:text-white">
                <span>Subtotal Current Assets</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(bs.totalCurrentAssets)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                Non-Current Fixed Assets
              </div>
              {bs.fixedAssets.map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1">
                  <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 font-semibold text-slate-900 dark:text-white">
                <span>Net Fixed Assets</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(bs.totalFixedAssets)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white">
              <span>Total Assets</span>
              <span className="font-mono tabular-nums">{formatCurrency(bs.totalAssets)}</span>
            </div>
          </div>

          {/* Liabilities & Equity Side */}
          <div className="p-5 space-y-5 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="font-semibold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                  Current Liabilities
                </div>
                {bs.currentLiabilities.map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-1">
                    <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                    <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 font-semibold text-slate-900 dark:text-white">
                  <span>Total Liabilities</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(bs.totalLiabilities)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                  Owner&apos;s Equity & Reserves
                </div>
                {bs.equityItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-1">
                    <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                    <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 font-semibold text-slate-900 dark:text-white">
                  <span>Total Owner&apos;s Equity</span>
                  <span className="font-mono tabular-nums">{formatCurrency(bs.totalEquity)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white">
              <span>Total Liabilities & Equity</span>
              <span className="font-mono tabular-nums">
                {formatCurrency(bs.totalLiabilitiesAndEquity)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
