import { CashDenominations, NozzleReading, ShiftRecord } from '../data/shiftTypes';

export function computeDenominationTotal(denom: CashDenominations): number {
  return (
    (denom.n5000 ?? 0) * 5000 +
    (denom.n1000 ?? 0) * 1000 +
    denom.n500 * 500 +
    (denom.n200 ?? 0) * 200 +
    denom.n100 * 100 +
    denom.n50 * 50 +
    denom.n20 * 20 +
    denom.n10 * 10 +
    denom.coins
  );
}

export function computeNozzleMetrics(nozzle: NozzleReading): {
  netLitres: number;
  grossAmount: number;
  hasInvalidReading: boolean;
} {
  const rawDelta = nozzle.closingReading - nozzle.openingReading;
  const hasInvalidReading = nozzle.closingReading < nozzle.openingReading;
  const netLitres = Math.max(0, +(rawDelta - nozzle.testingLitres).toFixed(3));
  const grossAmount = +(netLitres * nozzle.unitPrice).toFixed(2);
  return { netLitres, grossAmount, hasInvalidReading };
}

export interface ShiftFinancialSummary {
  totalLitresDispensed: number;
  totalTestingLitres: number;
  totalMeterSales: number;
  nonCashTendersTotal: number;
  cashDrawerExpensesTotal: number;
  allExpensesTotal: number;
  expectedCashInDrawer: number;
  actualCashCollected: number;
  cashVariance: number;
  hasInvalidNozzleReading: boolean;
}

export function computeShiftSummary(shift: ShiftRecord): ShiftFinancialSummary {
  let totalLitresDispensed = 0;
  let totalTestingLitres = 0;
  let totalMeterSales = 0;
  let hasInvalidNozzleReading = false;

  for (const nozzle of shift.nozzles) {
    const m = computeNozzleMetrics(nozzle);
    if (m.hasInvalidReading) hasInvalidNozzleReading = true;
    totalLitresDispensed += m.netLitres;
    totalTestingLitres += nozzle.testingLitres;
    totalMeterSales += m.grossAmount;
  }

  const nonCashTendersTotal =
    shift.tenders.upiAmount + shift.tenders.cardAmount + shift.tenders.creditSlipAmount;

  const cashDrawerExpensesTotal = shift.expenses
    .filter((e) => e.paidFromCashDrawer)
    .reduce((sum, e) => sum + e.amount, 0);

  const allExpensesTotal = shift.expenses.reduce((sum, e) => sum + e.amount, 0);

  const expectedCashInDrawer = +(
    shift.openingCashFloat +
    totalMeterSales -
    nonCashTendersTotal -
    cashDrawerExpensesTotal
  ).toFixed(2);

  const actualCashCollected = +computeDenominationTotal(shift.tenders.denominations).toFixed(2);
  const cashVariance = +(actualCashCollected - expectedCashInDrawer).toFixed(2);

  return {
    totalLitresDispensed: +totalLitresDispensed.toFixed(2),
    totalTestingLitres: +totalTestingLitres.toFixed(2),
    totalMeterSales: +totalMeterSales.toFixed(2),
    nonCashTendersTotal: +nonCashTendersTotal.toFixed(2),
    cashDrawerExpensesTotal: +cashDrawerExpensesTotal.toFixed(2),
    allExpensesTotal: +allExpensesTotal.toFixed(2),
    expectedCashInDrawer,
    actualCashCollected,
    cashVariance,
    hasInvalidNozzleReading,
  };
}

export function formatCurrency(amount: number): string {
  const absFormatted = Math.abs(amount).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-Rs. ${absFormatted}` : `Rs. ${absFormatted}`;
}

export function formatLitres(litres: number): string {
  return `${litres.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} L`;
}
