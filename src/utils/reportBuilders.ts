import { EXPENSE_CATEGORY_LABELS } from '../data/accountingSeedData';
import { AccountingTransactionRecord } from '../data/accountingTypes';
import {
  FuelDeliveryRecord,
  PurchaseOrderRecord,
  SupplierInvoiceRecord,
} from '../data/purchaseTypes';
import { STATION_DISPENSER_MACHINES } from '../data/salesSeedData';
import { SalesTransactionRecord } from '../data/salesTypes';
import { ShiftRecord } from '../data/shiftTypes';
import { StorageTankStock } from '../data/stockTypes';
import { computeProfitAndLoss } from './accountingMath';
import { ExportableReportPayload } from './reportExporter';
import {
  computeNozzleMetrics,
  computeShiftSummary,
  formatCurrency,
  formatLitres,
} from './shiftMath';

export type ReportKind =
  | 'daily'
  | 'shift'
  | 'operator'
  | 'machine'
  | 'purchase'
  | 'sales'
  | 'stock'
  | 'profit';

export interface ReportDatasetBundle {
  stationLabel: string;
  dateFilter: string; // 'ALL' or 'YYYY-MM-DD'
  shifts: ShiftRecord[];
  sales: SalesTransactionRecord[];
  purchaseOrders: PurchaseOrderRecord[];
  deliveries: FuelDeliveryRecord[];
  invoices: SupplierInvoiceRecord[];
  tanks: StorageTankStock[];
  accountingTransactions: AccountingTransactionRecord[];
}

function nowFormatted(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

export function buildReportPayload(
  kind: ReportKind,
  bundle: ReportDatasetBundle
): ExportableReportPayload {
  const generatedAt = nowFormatted();
  const dateScopeText =
    bundle.dateFilter === 'ALL' ? 'All Recorded Dates' : `Date: ${bundle.dateFilter}`;

  const filteredShifts =
    bundle.dateFilter === 'ALL'
      ? bundle.shifts
      : bundle.shifts.filter((s) => s.businessDate === bundle.dateFilter);

  const filteredSales =
    bundle.dateFilter === 'ALL'
      ? bundle.sales.filter((s) => s.status === 'POSTED')
      : bundle.sales.filter(
          (s) => s.status === 'POSTED' && s.soldDate === bundle.dateFilter
        );

  switch (kind) {
    case 'daily': {
      const dateBuckets = new Map<
        string,
        {
          date: string;
          shiftsCount: number;
          litres: number;
          meterSales: number;
          cashCollected: number;
          digitalTotal: number;
          creditTotal: number;
          expensesTotal: number;
          variance: number;
        }
      >();

      filteredShifts.forEach((shift) => {
        const sum = computeShiftSummary(shift);
        const existing = dateBuckets.get(shift.businessDate) ?? {
          date: shift.businessDate,
          shiftsCount: 0,
          litres: 0,
          meterSales: 0,
          cashCollected: 0,
          digitalTotal: 0,
          creditTotal: 0,
          expensesTotal: 0,
          variance: 0,
        };
        existing.shiftsCount += 1;
        existing.litres += sum.totalLitresDispensed;
        existing.meterSales += sum.totalMeterSales;
        existing.cashCollected += sum.actualCashCollected;
        existing.digitalTotal += shift.tenders.upiAmount + shift.tenders.cardAmount;
        existing.creditTotal += shift.tenders.creditSlipAmount;
        existing.expensesTotal += sum.allExpensesTotal;
        existing.variance += sum.cashVariance;
        dateBuckets.set(shift.businessDate, existing);
      });

      const days = Array.from(dateBuckets.values()).sort((a, b) =>
        b.date.localeCompare(a.date)
      );
      const totalLitres = days.reduce((s, d) => s + d.litres, 0);
      const totalRevenue = days.reduce((s, d) => s + d.meterSales, 0);
      const totalCash = days.reduce((s, d) => s + d.cashCollected, 0);
      const totalVariance = days.reduce((s, d) => s + d.variance, 0);

      return {
        id: 'daily',
        title: 'Daily Operations Report (DSR)',
        subtitle: `Daily Sales Register across Shifts & Tenders · ${dateScopeText}`,
        stationLabel: bundle.stationLabel,
        generatedAt,
        summaryMetrics: [
          { label: 'Business Days', value: `${days.length} day(s)` },
          { label: 'Total Fuel Dispensed', value: formatLitres(totalLitres) },
          { label: 'Total Meter Sales', value: formatCurrency(totalRevenue) },
          { label: 'Actual Cash Collected', value: formatCurrency(totalCash) },
          { label: 'Net Cash Variance', value: formatCurrency(totalVariance) },
        ],
        columns: [
          { key: 'date', label: 'Business Date' },
          { key: 'shifts', label: 'Shifts', align: 'right' },
          { key: 'litres', label: 'Volume (L)', align: 'right' },
          { key: 'meterSales', label: 'Gross Sales', align: 'right' },
          { key: 'digital', label: 'UPI & Card', align: 'right' },
          { key: 'credit', label: 'Fleet Credit', align: 'right' },
          { key: 'cash', label: 'Cash Collected', align: 'right' },
          { key: 'expenses', label: 'Expenses', align: 'right' },
          { key: 'variance', label: 'Cash Variance', align: 'right' },
        ],
        rows: days.map((d) => ({
          date: d.date,
          shifts: d.shiftsCount,
          litres: formatLitres(d.litres),
          meterSales: formatCurrency(d.meterSales),
          digital: formatCurrency(d.digitalTotal),
          credit: formatCurrency(d.creditTotal),
          cash: formatCurrency(d.cashCollected),
          expenses: formatCurrency(d.expensesTotal),
          variance: formatCurrency(d.variance),
        })),
      };
    }

    case 'shift': {
      const summaries = filteredShifts.map((s) => ({
        shift: s,
        summary: computeShiftSummary(s),
      }));
      const totalLitres = summaries.reduce((acc, i) => acc + i.summary.totalLitresDispensed, 0);
      const totalMeter = summaries.reduce((acc, i) => acc + i.summary.totalMeterSales, 0);
      const totalCash = summaries.reduce((acc, i) => acc + i.summary.actualCashCollected, 0);
      const approvedCount = summaries.filter((i) => i.shift.status === 'APPROVED').length;

      return {
        id: 'shift',
        title: 'Shift Handover & Reconciliation Report',
        subtitle: `Day & Night Shift Meters, Tenders, Expenses & Approvals · ${dateScopeText}`,
        stationLabel: bundle.stationLabel,
        generatedAt,
        summaryMetrics: [
          { label: 'Shifts Audited', value: `${summaries.length}` },
          { label: 'Approved Shifts', value: `${approvedCount} / ${summaries.length}` },
          { label: 'Total Dispensed', value: formatLitres(totalLitres) },
          { label: 'Meter Sales Value', value: formatCurrency(totalMeter) },
          { label: 'Cash Remitted', value: formatCurrency(totalCash) },
        ],
        columns: [
          { key: 'shiftCode', label: 'Shift Code' },
          { key: 'dateType', label: 'Date · Period' },
          { key: 'supervisor', label: 'Supervisor' },
          { key: 'status', label: 'Status' },
          { key: 'litres', label: 'Dispensed (L)', align: 'right' },
          { key: 'meterSales', label: 'Meter Sales', align: 'right' },
          { key: 'actualCash', label: 'Cash Counted', align: 'right' },
          { key: 'expenses', label: 'Expenses', align: 'right' },
          { key: 'variance', label: 'Cash Variance', align: 'right' },
        ],
        rows: summaries.map(({ shift, summary }) => ({
          shiftCode: shift.shiftCode,
          dateType: `${shift.businessDate} · ${shift.shiftType}`,
          supervisor: shift.supervisorName,
          status: shift.status,
          litres: formatLitres(summary.totalLitresDispensed),
          meterSales: formatCurrency(summary.totalMeterSales),
          actualCash: formatCurrency(summary.actualCashCollected),
          expenses: formatCurrency(summary.allExpensesTotal),
          variance: formatCurrency(summary.cashVariance),
        })),
      };
    }

    case 'operator': {
      const opMap = new Map<
        string,
        {
          operatorName: string;
          nozzles: Set<string>;
          meterLitres: number;
          testingLitres: number;
          meterRevenue: number;
          posCount: number;
          posAmount: number;
        }
      >();

      filteredShifts.forEach((shift) => {
        shift.nozzles.forEach((n) => {
          const m = computeNozzleMetrics(n);
          const entry = opMap.get(n.operatorName) ?? {
            operatorName: n.operatorName,
            nozzles: new Set<string>(),
            meterLitres: 0,
            testingLitres: 0,
            meterRevenue: 0,
            posCount: 0,
            posAmount: 0,
          };
          entry.nozzles.add(n.nozzleCode);
          entry.meterLitres += m.netLitres;
          entry.testingLitres += n.testingLitres;
          entry.meterRevenue += m.grossAmount;
          opMap.set(n.operatorName, entry);
        });
      });

      filteredSales.forEach((sale) => {
        const entry = opMap.get(sale.operatorName) ?? {
          operatorName: sale.operatorName,
          nozzles: new Set<string>([sale.nozzleCode]),
          meterLitres: 0,
          testingLitres: 0,
          meterRevenue: 0,
          posCount: 0,
          posAmount: 0,
        };
        entry.posCount += 1;
        entry.posAmount += sale.totalAmount;
        opMap.set(sale.operatorName, entry);
      });

      const operators = Array.from(opMap.values()).sort(
        (a, b) => b.meterRevenue - a.meterRevenue
      );
      const totalLitres = operators.reduce((s, o) => s + o.meterLitres, 0);
      const totalRev = operators.reduce((s, o) => s + o.meterRevenue, 0);
      const totalTesting = operators.reduce((s, o) => s + o.testingLitres, 0);

      return {
        id: 'operator',
        title: 'Operator Performance Report',
        subtitle: `Attendant Nozzle Throughput, Testing & POS Activity · ${dateScopeText}`,
        stationLabel: bundle.stationLabel,
        generatedAt,
        summaryMetrics: [
          { label: 'Active Operators', value: `${operators.length}` },
          { label: 'Total Meter Litres', value: formatLitres(totalLitres) },
          { label: 'Total Meter Revenue', value: formatCurrency(totalRev) },
          { label: 'Total Testing Drawn', value: formatLitres(totalTesting) },
        ],
        columns: [
          { key: 'operator', label: 'Operator Name' },
          { key: 'nozzles', label: 'Assigned Nozzles' },
          { key: 'meterLitres', label: 'Net Dispensed', align: 'right' },
          { key: 'testing', label: 'Testing (L)', align: 'right' },
          { key: 'meterRev', label: 'Meter Sales', align: 'right' },
          { key: 'posCount', label: 'POS Receipts', align: 'right' },
          { key: 'posValue', label: 'POS Logged', align: 'right' },
        ],
        rows: operators.map((op) => ({
          operator: op.operatorName,
          nozzles: Array.from(op.nozzles).join(', '),
          meterLitres: formatLitres(op.meterLitres),
          testing: formatLitres(op.testingLitres),
          meterRev: formatCurrency(op.meterRevenue),
          posCount: op.posCount,
          posValue: formatCurrency(op.posAmount),
        })),
      };
    }

    case 'machine': {
      const nozzleRows: {
        dispenserCode: string;
        hardwareModel: string;
        nozzleCode: string;
        grade: string;
        opening: number;
        closing: number;
        testing: number;
        netLitres: number;
        revenue: number;
      }[] = [];

      const activeShift = filteredShifts[0] ?? bundle.shifts[0];
      if (activeShift) {
        activeShift.nozzles.forEach((n) => {
          const spec = STATION_DISPENSER_MACHINES.find(
            (m) => m.dispenserCode === n.dispenserCode
          );
          const m = computeNozzleMetrics(n);
          nozzleRows.push({
            dispenserCode: n.dispenserCode,
            hardwareModel: spec?.hardwareModel ?? 'Multi-Product Dispenser',
            nozzleCode: n.nozzleCode,
            grade: n.sku,
            opening: n.openingReading,
            closing: n.closingReading,
            testing: n.testingLitres,
            netLitres: m.netLitres,
            revenue: m.grossAmount,
          });
        });
      }

      const totalLitres = nozzleRows.reduce((s, r) => s + r.netLitres, 0);
      const totalRev = nozzleRows.reduce((s, r) => s + r.revenue, 0);
      const totalTesting = nozzleRows.reduce((s, r) => s + r.testing, 0);

      return {
        id: 'machine',
        title: 'Machine & Nozzle Throughput Report',
        subtitle: `Dispenser Totalizer Readings & Island Productivity (${activeShift?.shiftCode ?? 'Latest Shift'})`,
        stationLabel: bundle.stationLabel,
        generatedAt,
        summaryMetrics: [
          { label: 'Dispensers Online', value: `${STATION_DISPENSER_MACHINES.length} MPDs` },
          { label: 'Active Nozzles', value: `${nozzleRows.length}` },
          { label: 'Net Volume', value: formatLitres(totalLitres) },
          { label: 'Calibration Testing', value: formatLitres(totalTesting) },
          { label: 'Total Dispenser Sales', value: formatCurrency(totalRev) },
        ],
        columns: [
          { key: 'dispenser', label: 'Machine' },
          { key: 'model', label: 'Hardware Model' },
          { key: 'nozzle', label: 'Nozzle · Grade' },
          { key: 'opening', label: 'Opening Meter', align: 'right' },
          { key: 'closing', label: 'Closing Meter', align: 'right' },
          { key: 'testing', label: 'Testing (L)', align: 'right' },
          { key: 'netLitres', label: 'Net Dispensed', align: 'right' },
          { key: 'revenue', label: 'Meter Sales', align: 'right' },
        ],
        rows: nozzleRows.map((r) => ({
          dispenser: r.dispenserCode,
          model: r.hardwareModel,
          nozzle: `${r.nozzleCode} · ${r.grade}`,
          opening: r.opening.toFixed(2),
          closing: r.closing.toFixed(2),
          testing: r.testing.toFixed(2),
          netLitres: formatLitres(r.netLitres),
          revenue: formatCurrency(r.revenue),
        })),
      };
    }

    case 'purchase': {
      const deliveriesFiltered =
        bundle.dateFilter === 'ALL'
          ? bundle.deliveries
          : bundle.deliveries.filter((d) => d.deliveryDate === bundle.dateFilter);

      const totalOrderedLitres = bundle.purchaseOrders.reduce(
        (s, po) => s + po.totalOrderedLitres,
        0
      );
      const totalReceivedLitres = deliveriesFiltered.reduce(
        (s, d) => s + d.receivedQtyLitres,
        0
      );
      const totalShortage = deliveriesFiltered.reduce((s, d) => s + d.shortageLitres, 0);
      const totalBilled = bundle.invoices.reduce((s, inv) => s + inv.totalAmount, 0);
      const totalBalanceDue = bundle.invoices.reduce(
        (s, inv) => s + (inv.totalAmount - inv.paidAmount),
        0
      );

      return {
        id: 'purchase',
        title: 'Purchase & Tanker Receiving Report',
        subtitle: `OMC Tanker GRNs, Transit Shortages & Vendor Tax Invoices · ${dateScopeText}`,
        stationLabel: bundle.stationLabel,
        generatedAt,
        summaryMetrics: [
          { label: 'Purchase Orders', value: `${bundle.purchaseOrders.length} POs` },
          { label: 'Ordered Volume', value: formatLitres(totalOrderedLitres) },
          { label: 'Received Volume', value: formatLitres(totalReceivedLitres) },
          { label: 'Transit Shortage', value: formatLitres(totalShortage) },
          { label: 'Invoiced / Due', value: `${formatCurrency(totalBilled)} / ${formatCurrency(totalBalanceDue)}` },
        ],
        columns: [
          { key: 'date', label: 'Delivery Date' },
          { key: 'invoice', label: 'Invoice / GRN' },
          { key: 'supplier', label: 'Supplier · Tanker' },
          { key: 'product', label: 'Product · Tank' },
          { key: 'invoicedQty', label: 'Invoiced (L)', align: 'right' },
          { key: 'receivedQty', label: 'Received (L)', align: 'right' },
          { key: 'shortage', label: 'Shortage (L)', align: 'right' },
          { key: 'density', label: 'Density', align: 'right' },
          { key: 'amount', label: 'Invoice Value', align: 'right' },
          { key: 'status', label: 'Status' },
        ],
        rows: deliveriesFiltered.map((del) => ({
          date: del.deliveryDate,
          invoice: del.invoiceNumber,
          supplier: `${del.supplierName} (${del.tankerRegNo})`,
          product: `${del.productName} -> ${del.targetTankCode}`,
          invoicedQty: formatLitres(del.invoicedQtyLitres),
          receivedQty: formatLitres(del.receivedQtyLitres),
          shortage: formatLitres(del.shortageLitres),
          density: del.densityObserved.toFixed(3),
          amount: formatCurrency(del.totalInvoiceAmount),
          status: del.status,
        })),
      };
    }

    case 'sales': {
      const cashTotal = filteredSales
        .filter((s) => s.paymentMode === 'CASH')
        .reduce((acc, s) => acc + s.totalAmount, 0);
      const onlineTotal = filteredSales
        .filter((s) => s.paymentMode === 'UPI' || s.paymentMode === 'CARD')
        .reduce((acc, s) => acc + s.totalAmount, 0);
      const creditTotal = filteredSales
        .filter((s) => s.paymentMode === 'CREDIT' || s.paymentMode === 'FLEET_CARD')
        .reduce((acc, s) => acc + s.totalAmount, 0);
      const totalLitres = filteredSales.reduce((acc, s) => acc + s.quantityLitres, 0);
      const totalSales = cashTotal + onlineTotal + creditTotal;

      return {
        id: 'sales',
        title: 'Sales & Tender Mix Report',
        subtitle: `POS Receipts across Cash, Online (UPI/Card) & Fleet Credit · ${dateScopeText}`,
        stationLabel: bundle.stationLabel,
        generatedAt,
        summaryMetrics: [
          { label: 'Posted Receipts', value: `${filteredSales.length}` },
          { label: 'Volume Sold', value: formatLitres(totalLitres) },
          { label: 'Cash Sales', value: formatCurrency(cashTotal) },
          { label: 'Online (UPI/Card)', value: formatCurrency(onlineTotal) },
          { label: 'Credit / Total', value: `${formatCurrency(creditTotal)} / ${formatCurrency(totalSales)}` },
        ],
        columns: [
          { key: 'receipt', label: 'Receipt No' },
          { key: 'dateTime', label: 'Date · Time' },
          { key: 'machine', label: 'Machine · Nozzle' },
          { key: 'grade', label: 'Fuel Grade' },
          { key: 'litres', label: 'Litres', align: 'right' },
          { key: 'rate', label: 'Rate/L', align: 'right' },
          { key: 'mode', label: 'Payment Mode' },
          { key: 'party', label: 'Vehicle / Fleet' },
          { key: 'amount', label: 'Total Amount', align: 'right' },
        ],
        rows: filteredSales.map((s) => ({
          receipt: s.receiptNumber,
          dateTime: `${s.soldDate} ${s.soldTimeLabel}`,
          machine: `${s.dispenserCode} · ${s.nozzleCode}`,
          grade: s.gradeCode,
          litres: formatLitres(s.quantityLitres),
          rate: formatCurrency(s.unitSellingPrice),
          mode: s.paymentMode,
          party: s.customerName || s.vehicleNo || 'Walk-in Retail',
          amount: formatCurrency(s.totalAmount),
        })),
      };
    }

    case 'stock': {
      const totalBook = bundle.tanks.reduce((s, t) => s + t.currentBookStockLitres, 0);
      const totalDip = bundle.tanks.reduce((s, t) => s + t.lastDipStockLitres, 0);
      const totalCap = bundle.tanks.reduce((s, t) => s + t.capacityLitres, 0);
      const totalUllage = Math.max(0, totalCap - totalBook);
      const lowAlerts = bundle.tanks.filter(
        (t) => t.currentBookStockLitres < t.minThresholdLitres
      ).length;

      return {
        id: 'stock',
        title: 'Underground Stock & Tank Dip Report',
        subtitle: `Petrol & Diesel Tank Book Stock, Physical Dip Variance & Threshold Alerts`,
        stationLabel: bundle.stationLabel,
        generatedAt,
        summaryMetrics: [
          { label: 'Underground Tanks', value: `${bundle.tanks.length} tanks` },
          { label: 'Total Book Stock', value: formatLitres(totalBook) },
          { label: 'Last Physical Dip', value: formatLitres(totalDip) },
          { label: 'Available Ullage', value: formatLitres(totalUllage) },
          { label: 'Low Stock Breaches', value: `${lowAlerts} tank(s)` },
        ],
        columns: [
          { key: 'tank', label: 'Tank Code' },
          { key: 'product', label: 'Fuel Grade' },
          { key: 'capacity', label: 'Capacity', align: 'right' },
          { key: 'bookStock', label: 'Book Stock', align: 'right' },
          { key: 'lastDip', label: 'Last Dip', align: 'right' },
          { key: 'variance', label: 'Dip Variance', align: 'right' },
          { key: 'ullage', label: 'Ullage', align: 'right' },
          { key: 'threshold', label: 'Min Threshold', align: 'right' },
          { key: 'status', label: 'Alert Status' },
        ],
        rows: bundle.tanks.map((t) => {
          const variance = +(t.lastDipStockLitres - t.currentBookStockLitres).toFixed(2);
          const ullage = Math.max(0, t.capacityLitres - t.currentBookStockLitres);
          const status =
            t.currentBookStockLitres < t.minThresholdLitres
              ? 'CRITICAL'
              : t.currentBookStockLitres <= t.minThresholdLitres * 1.25
              ? 'WARNING'
              : 'NOMINAL';
          return {
            tank: t.tankCode,
            product: `${t.gradeCode} · ${t.productName}`,
            capacity: formatLitres(t.capacityLitres),
            bookStock: formatLitres(t.currentBookStockLitres),
            lastDip: formatLitres(t.lastDipStockLitres),
            variance: `${variance >= 0 ? '+' : ''}${variance.toFixed(2)} L`,
            ullage: formatLitres(ullage),
            threshold: formatLitres(t.minThresholdLitres),
            status,
          };
        }),
      };
    }

    case 'profit': {
      const pl = computeProfitAndLoss(
        bundle.accountingTransactions,
        'MONTH',
        EXPENSE_CATEGORY_LABELS
      );

      const rows: Record<string, string | number>[] = pl.revenueLines.map((rev, idx) => {
        const cogs = pl.cogsLines[idx]?.amount ?? 0;
        const gross = +(rev.amount - cogs).toFixed(2);
        const marginPct = rev.amount > 0 ? +((gross / rev.amount) * 100).toFixed(2) : 0;
        return {
          section: 'Revenue & Gross Margin',
          item: rev.label,
          revenue: formatCurrency(rev.amount),
          costOrExpense: formatCurrency(cogs),
          netContribution: formatCurrency(gross),
          marginPct: `${marginPct}%`,
        };
      });

      pl.expenseLines.forEach((exp) => {
        if (exp.amount <= 0) return;
        rows.push({
          section: 'Operating Expense',
          item: exp.label,
          revenue: '—',
          costOrExpense: formatCurrency(exp.amount),
          netContribution: formatCurrency(-exp.amount),
          marginPct: 'OpEx',
        });
      });

      return {
        id: 'profit',
        title: 'Profitability & Margin Analysis Report',
        subtitle: `Owner-Only Gross Dealer Margin, Operating Expenses & EBITDA (${pl.periodLabel})`,
        stationLabel: bundle.stationLabel,
        generatedAt,
        summaryMetrics: [
          { label: 'Total Revenue', value: formatCurrency(pl.totalRevenue) },
          { label: 'Total COGS', value: formatCurrency(pl.totalCogs) },
          { label: 'Gross Profit', value: `${formatCurrency(pl.grossProfit)} (${pl.grossMarginPct}%)` },
          { label: 'Operating Expenses', value: formatCurrency(pl.totalExpenses) },
          { label: 'Net Operating Profit', value: `${formatCurrency(pl.netOperatingProfit)} (${pl.netMarginPct}%)` },
        ],
        columns: [
          { key: 'section', label: 'Category' },
          { key: 'item', label: 'Line Item' },
          { key: 'revenue', label: 'Revenue', align: 'right' },
          { key: 'costOrExpense', label: 'COGS / Expense', align: 'right' },
          { key: 'netContribution', label: 'Net Impact', align: 'right' },
          { key: 'marginPct', label: 'Margin / Tag', align: 'right' },
        ],
        rows,
      };
    }
  }
}
