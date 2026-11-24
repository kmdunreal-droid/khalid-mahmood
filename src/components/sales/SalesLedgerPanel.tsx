import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Building,
  CheckCircle2,
  Plus,
  Smartphone,
  X,
  XCircle,
} from 'lucide-react';
import { ActiveRolePersona } from '../../data/shiftTypes';
import {
  CreditCustomerAccount,
  NozzleRateConfig,
  ProfitAssumptions,
  SalePaymentMode,
  SalesTransactionRecord,
} from '../../data/salesTypes';
import { formatCurrency, formatLitres } from '../../utils/shiftMath';

export type SalesChannelKind = 'CASH' | 'CREDIT' | 'ONLINE';

interface SalesLedgerPanelProps {
  channel: SalesChannelKind;
  nozzles: NozzleRateConfig[];
  sales: SalesTransactionRecord[];
  creditCustomers: CreditCustomerAccount[];
  profitAssumptions: ProfitAssumptions;
  rolePersona: ActiveRolePersona;
  initialDispenserOrNozzle?: { dispenserCode?: string; nozzleCode?: string } | null;
  onClearInitialSelection: () => void;
  onRecordSale: (
    sale: Omit<SalesTransactionRecord, 'id' | 'stationId' | 'operatorUid' | 'soldTimeLabel'>
  ) => Promise<void> | void;
  onVoidSale: (saleId: string) => Promise<void> | void;
}

export const SalesLedgerPanel: React.FC<SalesLedgerPanelProps> = ({
  channel,
  nozzles,
  sales,
  creditCustomers,
  profitAssumptions,
  rolePersona,
  initialDispenserOrNozzle,
  onClearInitialSelection,
  onRecordSale,
  onVoidSale,
}) => {
  const canViewProfit = rolePersona === 'OWNER' || rolePersona === 'MANAGER';
  const canVoid = rolePersona === 'OWNER' || rolePersona === 'MANAGER';

  const [onlineSubFilter, setOnlineSubFilter] = useState<'ALL' | 'UPI' | 'CARD' | 'FLEET_CARD'>('ALL');
  const [showVoided, setShowVoided] = useState<boolean>(false);
  const [showCreateForm, setShowCreateForm] = useState<boolean>(Boolean(initialDispenserOrNozzle));
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const defaultNozzle = useMemo(() => {
    if (initialDispenserOrNozzle?.nozzleCode) {
      return nozzles.find((n) => n.nozzleCode === initialDispenserOrNozzle.nozzleCode) ?? nozzles[0];
    }
    if (initialDispenserOrNozzle?.dispenserCode) {
      return nozzles.find((n) => n.dispenserCode === initialDispenserOrNozzle.dispenserCode) ?? nozzles[0];
    }
    return nozzles[0];
  }, [nozzles, initialDispenserOrNozzle]);

  const [selectedNozzleCode, setSelectedNozzleCode] = useState<string>(defaultNozzle.nozzleCode);
  const [quantityLitres, setQuantityLitres] = useState<string>('25');
  const [paymentMode, setPaymentMode] = useState<SalePaymentMode>(
    channel === 'CASH' ? 'CASH' : channel === 'CREDIT' ? 'CREDIT' : 'UPI'
  );
  const [customerId, setCustomerId] = useState<string>(
    creditCustomers.find((c) => c.status === 'ACTIVE')?.id ?? creditCustomers[0]?.id ?? ''
  );
  const [vehicleNo, setVehicleNo] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [receiptNumber, setReceiptNumber] = useState<string>(
    `${channel === 'CREDIT' ? 'CR' : 'POS'}-2311-${String(820 + sales.length).padStart(4, '0')}`
  );

  const chosenNozzle = nozzles.find((n) => n.nozzleCode === selectedNozzleCode) ?? nozzles[0];
  const parsedQty = Number(quantityLitres) || 0;
  const computedTotal = +(parsedQty * chosenNozzle.unitSellingPrice).toFixed(2);
  const landedCost = profitAssumptions.costByGrade[chosenNozzle.gradeCode] ?? chosenNozzle.unitCostPrice;
  const computedProfit = +((chosenNozzle.unitSellingPrice - landedCost) * parsedQty).toFixed(2);

  const channelSales = useMemo(() => {
    return sales.filter((s) => {
      if (!showVoided && s.status === 'VOIDED') return false;
      if (channel === 'CASH') return s.paymentMode === 'CASH';
      if (channel === 'CREDIT') return s.paymentMode === 'CREDIT';
      if (onlineSubFilter !== 'ALL') return s.paymentMode === onlineSubFilter;
      return s.paymentMode === 'UPI' || s.paymentMode === 'CARD' || s.paymentMode === 'FLEET_CARD';
    });
  }, [sales, channel, onlineSubFilter, showVoided]);

  const channelMetrics = useMemo(() => {
    const posted = channelSales.filter((s) => s.status === 'POSTED');
    const totalRev = posted.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalLitres = posted.reduce((sum, s) => sum + s.quantityLitres, 0);
    const totalProfit = posted.reduce((sum, s) => {
      const cost = profitAssumptions.costByGrade[s.gradeCode] ?? s.unitCostPrice;
      return sum + (s.unitSellingPrice - cost) * s.quantityLitres;
    }, 0);
    const upiTotal = posted.filter((s) => s.paymentMode === 'UPI').reduce((sum, s) => sum + s.totalAmount, 0);
    const cardTotal = posted.filter((s) => s.paymentMode === 'CARD').reduce((sum, s) => sum + s.totalAmount, 0);
    const fleetCardTotal = posted.filter((s) => s.paymentMode === 'FLEET_CARD').reduce((sum, s) => sum + s.totalAmount, 0);
    const mdrFee = channel === 'ONLINE' ? +((totalRev * profitAssumptions.onlineMdrPct) / 100).toFixed(2) : 0;

    return {
      count: posted.length,
      totalRev: +totalRev.toFixed(2),
      totalLitres: +totalLitres.toFixed(2),
      totalProfit: +totalProfit.toFixed(2),
      avgTicket: posted.length > 0 ? +(totalRev / posted.length).toFixed(2) : 0,
      upiTotal: +upiTotal.toFixed(2),
      cardTotal: +cardTotal.toFixed(2),
      fleetCardTotal: +fleetCardTotal.toFixed(2),
      mdrFee,
    };
  }, [channelSales, channel, profitAssumptions]);

  const handleRupeePreset = (inr: number) => {
    const litres = +(inr / chosenNozzle.unitSellingPrice).toFixed(2);
    setQuantityLitres(String(litres));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (parsedQty <= 0 || computedTotal <= 0) {
      setFormError('Quantity in litres must be greater than zero.');
      return;
    }
    if (receiptNumber.trim().length < 3) {
      setFormError('Receipt number must be at least 3 characters.');
      return;
    }

    let linkedCustomer: CreditCustomerAccount | undefined;
    if (channel === 'CREDIT') {
      linkedCustomer = creditCustomers.find((c) => c.id === customerId);
      if (!linkedCustomer) {
        setFormError('Select a corporate fleet credit customer.');
        return;
      }
      if (linkedCustomer.status !== 'ACTIVE' && rolePersona !== 'OWNER') {
        setFormError(
          `Customer "${linkedCustomer.companyName}" is on ${linkedCustomer.status}. Only Owner can override a hold.`
        );
        return;
      }
      const remainingCredit = linkedCustomer.creditLimit - linkedCustomer.currentBalance;
      if (computedTotal > remainingCredit && rolePersona !== 'OWNER') {
        setFormError(
          `Credit limit exceeded. Available headroom: ${formatCurrency(remainingCredit)}.`
        );
        return;
      }
      if (vehicleNo.trim().length < 4) {
        setFormError('Authorized fleet vehicle registration number is required for credit slips.');
        return;
      }
    }

    if (channel === 'ONLINE' && paymentReference.trim().length < 3) {
      setFormError('Enter Online QR Reference, Card RRN, or Fleet Card transaction ID.');
      return;
    }

    setSaving(true);
    try {
      await onRecordSale({
        shiftId: 'shf-20261123-day',
        dispenserCode: chosenNozzle.dispenserCode,
        nozzleCode: chosenNozzle.nozzleCode,
        productName: chosenNozzle.productName,
        gradeCode: chosenNozzle.gradeCode,
        quantityLitres: +parsedQty.toFixed(2),
        unitSellingPrice: chosenNozzle.unitSellingPrice,
        unitCostPrice: landedCost,
        grossProfit: computedProfit,
        operatorName: chosenNozzle.operatorName,
        customerId: linkedCustomer?.id,
        customerName: linkedCustomer?.companyName,
        receiptNumber: receiptNumber.trim().slice(0, 40),
        paymentMode: channel === 'CASH' ? 'CASH' : channel === 'CREDIT' ? 'CREDIT' : paymentMode,
        paymentReference: paymentReference.trim().slice(0, 64) || undefined,
        vehicleNo: vehicleNo.trim().toUpperCase().slice(0, 24) || undefined,
        totalAmount: computedTotal,
        status: 'POSTED',
        soldDate: new Date().toISOString().slice(0, 10),
      });
      setShowCreateForm(false);
      onClearInitialSelection();
      setVehicleNo('');
      setPaymentReference('');
      setReceiptNumber(
        `${channel === 'CREDIT' ? 'CR' : 'POS'}-2311-${String(821 + sales.length).padStart(4, '0')}`
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to post sale receipt.');
    } finally {
      setSaving(false);
    }
  };

  const titleLabel =
    channel === 'CASH'
      ? 'Cash Sales Counter'
      : channel === 'CREDIT'
      ? 'Fleet Credit Sales'
      : 'Online & Digital Sales (QR / Card / Fleet Card)';

  const channelIcon =
    channel === 'CASH' ? (
      <Banknote className="w-4 h-4 text-blue-600 dark:text-blue-400" />
    ) : channel === 'CREDIT' ? (
      <Building className="w-4 h-4 text-blue-600 dark:text-blue-400" />
    ) : (
      <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
    );

  return (
    <div className="space-y-5">
      {/* Channel KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {channel === 'CASH'
              ? 'Cash Collected'
              : channel === 'CREDIT'
              ? 'Credit Slips Billed'
              : 'Online Digital Total'}
          </div>
          <div className="mt-1 text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(channelMetrics.totalRev)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {channelMetrics.count} posted receipts
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Fuel Volume Sold</div>
          <div className="mt-1 text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatLitres(channelMetrics.totalLitres)}
          </div>
          <div className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Avg ticket {formatCurrency(channelMetrics.avgTicket)}
          </div>
        </div>

        {channel === 'ONLINE' ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Channel Split</div>
            <div className="mt-1 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
              Online / QR {formatCurrency(channelMetrics.upiTotal)}
            </div>
            <div className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Card {formatCurrency(channelMetrics.cardTotal)} · Fleet{' '}
              {formatCurrency(channelMetrics.fleetCardTotal)}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {channel === 'CREDIT' ? 'Active Fleet Accounts' : 'Tender Settlement'}
            </div>
            <div className="mt-1 text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
              {channel === 'CREDIT'
                ? creditCustomers.filter((c) => c.status === 'ACTIVE').length
                : 'Cash Drawer'}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {channel === 'CREDIT'
                ? `${creditCustomers.filter((c) => c.status === 'HOLD').length} account on hold`
                : 'Reconciles with Shift Cash Drop'}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {canViewProfit ? 'Auto Gross Profit' : 'Shift Status'}
          </div>
          <div className="mt-1 text-xl font-semibold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            {canViewProfit ? formatCurrency(channelMetrics.totalProfit) : 'ACTIVE'}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {channel === 'ONLINE' && canViewProfit
              ? `Est. MDR fee: ${formatCurrency(channelMetrics.mdrFee)}`
              : canViewProfit
              ? 'Retail minus landed fuel cost'
              : 'Operator shift window'}
          </div>
        </div>
      </div>

      {/* Fleet Credit Limit Watch (Shown in Credit Sales tab) */}
      {channel === 'CREDIT' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white">
            Corporate Fleet Credit Headroom & Vehicle Whitelists
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Account</th>
                  <th className="py-2.5 px-4">Whitelisted Vehicles</th>
                  <th className="py-2.5 px-4 text-right">Credit Limit</th>
                  <th className="py-2.5 px-4 text-right">Current Balance</th>
                  <th className="py-2.5 px-4 text-right">Available Headroom</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {creditCustomers.map((c) => {
                  const available = Math.max(0, c.creditLimit - c.currentBalance);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900 dark:text-white">{c.companyName}</div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {c.accountCode}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {c.whitelistedVehicles.join(', ')}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {formatCurrency(c.creditLimit)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(c.currentBalance)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(available)}
                      </td>
                      <td className="py-2.5 px-4">
                        {c.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{c.status}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {channel === 'ONLINE' &&
            (['ALL', 'UPI', 'CARD', 'FLEET_CARD'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setOnlineSubFilter(m)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors whitespace-nowrap ${
                  onlineSubFilter === m
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {m === 'ALL'
                  ? 'All Digital Modes'
                  : m === 'UPI'
                  ? 'Online / QR'
                  : m.replace('_', ' ')}
              </button>
            ))}

          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showVoided}
              onChange={(e) => setShowVoided(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
            <span>Include Voided Receipts</span>
          </label>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setShowCreateForm((v) => !v);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>
            {channel === 'CASH'
              ? 'Record Cash Sale'
              : channel === 'CREDIT'
              ? 'Issue Fleet Credit Slip'
              : 'Record Online Sale'}
          </span>
        </button>
      </div>

      {/* Record Sale Form */}
      {showCreateForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              {channelIcon}
              <span>{titleLabel} — Issue New Receipt</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                onClearInitialSelection();
              }}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 rounded-xl px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Machine & Nozzle
              </label>
              <select
                value={selectedNozzleCode}
                onChange={(e) => setSelectedNozzleCode(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                {nozzles.map((n) => (
                  <option key={n.nozzleCode} value={n.nozzleCode}>
                    {n.dispenserCode} · {n.nozzleCode} — {n.productName} (Rs. {n.unitSellingPrice.toFixed(2)}/L)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Quantity (Litres)
              </label>
              <input
                type="number"
                min={0.1}
                step="0.01"
                value={quantityLitres}
                onChange={(e) => setQuantityLitres(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <div className="flex items-center gap-2 mt-1.5">
                {[500, 1000, 2000, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleRupeePreset(amt)}
                    className="text-[10px] font-mono text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Rs. {amt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Receipt / Slip Number
              </label>
              <input
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                maxLength={40}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            {channel === 'ONLINE' && (
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Online Payment Rail
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as SalePaymentMode)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="UPI">Online / QR Wallet</option>
                  <option value="CARD">Debit / Credit Card POS</option>
                  <option value="FLEET_CARD">Company Fleet Card</option>
                </select>
              </div>
            )}

            {channel === 'CREDIT' && (
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Fleet Credit Customer
                </label>
                <select
                  value={customerId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setCustomerId(cid);
                    const cust = creditCustomers.find((c) => c.id === cid);
                    if (cust?.whitelistedVehicles[0]) {
                      setVehicleNo(cust.whitelistedVehicles[0]);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  {creditCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} (Avail: {formatCurrency(Math.max(0, c.creditLimit - c.currentBalance))})
                      {c.status !== 'ACTIVE' ? ` [${c.status}]` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(channel === 'ONLINE' || channel === 'CREDIT') && (
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {channel === 'CREDIT' ? 'Credit Slip Ref' : 'Transaction Ref / RRN'}
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  maxLength={64}
                  placeholder={channel === 'CREDIT' ? 'SLIP-KHL-9921' : 'QR-632899012241'}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Vehicle Registration {channel === 'CREDIT' ? '(Required)' : '(Optional)'}
              </label>
              <input
                type="text"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                maxLength={24}
                placeholder="LEA-4410"
                className="w-full px-3 py-2 text-xs font-mono uppercase border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
            <div className="text-xs text-slate-700 dark:text-slate-300">
              Total Receipt:{' '}
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                {formatCurrency(computedTotal)}
              </span>
              {canViewProfit && (
                <span className="ml-3 text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                  · Auto Gross Profit: {formatCurrency(computedProfit)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  onClearInitialSelection();
                }}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-white dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {saving ? 'Posting...' : 'Post Receipt'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Channel Receipts Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Receipt</th>
                <th className="py-2.5 px-4">Machine / Nozzle</th>
                <th className="py-2.5 px-4">
                  {channel === 'CREDIT'
                    ? 'Fleet Customer & Vehicle'
                    : channel === 'ONLINE'
                    ? 'Mode & Reference'
                    : 'Vehicle / Operator'}
                </th>
                <th className="py-2.5 px-4 text-right">Volume</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
                {canViewProfit && <th className="py-2.5 px-4 text-right">Auto Profit</th>}
                <th className="py-2.5 px-4">Status</th>
                {canVoid && <th className="py-2.5 px-4 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {channelSales.map((s) => {
                const cost = profitAssumptions.costByGrade[s.gradeCode] ?? s.unitCostPrice;
                const liveProfit = +((s.unitSellingPrice - cost) * s.quantityLitres).toFixed(2);
                const isVoided = s.status === 'VOIDED';
                const modeLabel = s.paymentMode === 'UPI' ? 'Online / QR' : s.paymentMode;
                return (
                  <tr
                    key={s.id}
                    className={`transition-colors ${
                      isVoided
                        ? 'bg-slate-50 dark:bg-slate-950/40 text-slate-400 dark:text-slate-500'
                        : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono">
                      <div className="font-semibold text-slate-900 dark:text-white">{s.receiptNumber}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {s.soldDate} · {s.soldTimeLabel}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-medium text-slate-900 dark:text-white">
                        {s.dispenserCode} · {s.nozzleCode}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{s.productName}</div>
                    </td>
                    <td className="py-3 px-4">
                      {channel === 'CREDIT' ? (
                        <>
                          <div className="font-medium text-slate-900 dark:text-white">
                            {s.customerName || 'Fleet Account'}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            {s.vehicleNo || 'N/A'} {s.paymentReference ? `· ${s.paymentReference}` : ''}
                          </div>
                        </>
                      ) : channel === 'ONLINE' ? (
                        <>
                          <div className="font-medium text-slate-900 dark:text-white">{modeLabel}</div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            {s.paymentReference || 'Digital Batch'}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-mono text-slate-900 dark:text-white">
                            {s.vehicleNo || 'Walk-in Vehicle'}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {s.operatorName}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {formatLitres(s.quantityLitres)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(s.totalAmount)}
                    </td>
                    {canViewProfit && (
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                        {isVoided ? 'Rs. 0.00' : formatCurrency(liveProfit)}
                      </td>
                    )}
                    <td className="py-3 px-4">
                      {isVoided ? (
                        <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400 font-medium">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Voided</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Posted</span>
                        </span>
                      )}
                    </td>
                    {canVoid && (
                      <td className="py-3 px-4 text-right">
                        {!isVoided && (
                          <button
                            type="button"
                            onClick={() => onVoidSale(s.id)}
                            className="text-[11px] font-medium text-red-600 dark:text-red-400 hover:underline whitespace-nowrap"
                          >
                            Void Receipt
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {channelSales.length === 0 && (
                <tr>
                  <td
                    colSpan={canViewProfit ? (canVoid ? 8 : 7) : canVoid ? 7 : 6}
                    className="py-8 text-center text-xs text-slate-500 dark:text-slate-400"
                  >
                    No transactions recorded under {titleLabel}.
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
