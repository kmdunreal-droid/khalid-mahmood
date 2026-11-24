import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  CheckCircle2,
  Edit3,
  Fuel,
  X,
} from 'lucide-react';
import {
  FuelFamily,
  FuelProductStock,
  StockDirection,
  StockMovementRecord,
  StorageTankStock,
} from '../../data/stockTypes';
import { formatCurrency, formatLitres } from '../../utils/shiftMath';

interface FuelGradeStockTabProps {
  fuelFamily: FuelFamily;
  products: FuelProductStock[];
  tanks: StorageTankStock[];
  movements: StockMovementRecord[];
  canMutate: boolean;
  onUpdateSellingPrice: (productId: string, newPrice: number) => Promise<void>;
  onQuickMovement: (direction: StockDirection, tankId: string) => void;
}

export const FuelGradeStockTab: React.FC<FuelGradeStockTabProps> = ({
  fuelFamily,
  products,
  tanks,
  movements,
  canMutate,
  onUpdateSellingPrice,
  onQuickMovement,
}) => {
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState<string>('');
  const [savingPrice, setSavingPrice] = useState<boolean>(false);

  const familyProducts = products.filter((p) => p.fuelFamily === fuelFamily);
  const familyTanks = tanks.filter((t) => t.fuelFamily === fuelFamily);
  const familyMovements = movements
    .filter((m) => m.fuelFamily === fuelFamily)
    .slice(0, 8);

  const totalCapacity = familyTanks.reduce((s, t) => s + t.capacityLitres, 0);
  const totalBook = familyTanks.reduce((s, t) => s + t.currentBookStockLitres, 0);
  const totalDip = familyTanks.reduce((s, t) => s + t.lastDipStockLitres, 0);
  const totalUllage = Math.max(0, totalCapacity - totalBook);
  const fillPct = totalCapacity > 0 ? +((totalBook / totalCapacity) * 100).toFixed(1) : 0;
  const totalDailyOutflow = familyProducts.reduce(
    (s, p) => s + (p.avgDailyOutflowLitres || 1000),
    0
  );
  const estDaysCover = totalDailyOutflow > 0 ? +(totalBook / totalDailyOutflow).toFixed(1) : 0;

  const isPetrol = fuelFamily === 'PETROL';
  const titleLabel = isPetrol ? 'Petrol Stock (MS-91 · MS-95)' : 'Diesel Stock (HSD-STD)';
  const subtitleLabel = isPetrol
    ? 'Live underground inventory, pump rates, and days-of-cover across motor spirit grades.'
    : 'High-throughput commercial diesel reserves across primary and reserve underground tanks.';

  const startPriceEdit = (product: FuelProductStock) => {
    setEditingProductId(product.id);
    setPriceDraft(product.currentSellingPrice.toFixed(2));
  };

  const commitPriceEdit = async (productId: string) => {
    const parsed = Number(priceDraft);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setSavingPrice(true);
    try {
      await onUpdateSellingPrice(productId, +parsed.toFixed(2));
      setEditingProductId(null);
    } finally {
      setSavingPrice(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Aggregate Summary */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Fuel
                className={`w-4 h-4 ${
                  isPetrol ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'
                }`}
              />
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{titleLabel}</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitleLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Combined Book Stock</span>
              <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white text-sm">
                {formatLitres(totalBook)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Last Physical Dip</span>
              <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200 text-sm">
                {formatLitres(totalDip)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Ullage Headspace</span>
              <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200 text-sm">
                {formatLitres(totalUllage)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Est. Days of Cover</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white text-sm">
                {estDaysCover} days · {fillPct}% full
              </span>
            </div>
          </div>
        </div>

        {/* Grade Catalog Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          {familyProducts.map((product) => {
            const gradeTanks = familyTanks.filter((t) => t.productId === product.id);
            const gradeStock = gradeTanks.reduce((s, t) => s + t.currentBookStockLitres, 0);
            const gradeCap = gradeTanks.reduce((s, t) => s + t.capacityLitres, 0);
            const isBelowReorder = gradeStock < product.reorderLevel;
            const daysRemaining =
              product.avgDailyOutflowLitres > 0
                ? +(gradeStock / product.avgDailyOutflowLitres).toFixed(1)
                : 0;
            const isEditing = editingProductId === product.id;

            return (
              <div
                key={product.id}
                className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/60 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {product.sku}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {product.name}
                    </div>
                  </div>
                  <div className="text-right">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="1"
                          value={priceDraft}
                          onChange={(e) => setPriceDraft(e.target.value)}
                          className="w-24 px-2 py-1 text-xs font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          aria-label={`Selling price for ${product.name}`}
                        />
                        <button
                          type="button"
                          disabled={savingPrice}
                          onClick={() => commitPriceEdit(product.id)}
                          className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                          title="Save pump selling price"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingProductId(null)}
                          className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Pump Price / L
                          </div>
                          <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                            {formatCurrency(product.currentSellingPrice)}
                          </div>
                        </div>
                        {canMutate && (
                          <button
                            type="button"
                            onClick={() => startPriceEdit(product)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                            title="Update daily nozzle rate"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">On-Hand Stock</div>
                    <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {formatLitres(gradeStock)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">Reorder Level</div>
                    <div className="font-mono tabular-nums font-medium text-slate-700 dark:text-slate-300">
                      {formatLitres(product.reorderLevel)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">Runway</div>
                    <div className="font-mono tabular-nums font-medium text-slate-700 dark:text-slate-300">
                      {daysRemaining} days ({gradeCap > 0 ? Math.round((gradeStock / gradeCap) * 100) : 0}%)
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  {isBelowReorder ? (
                    <span className="inline-flex items-center gap-1.5 text-red-700 dark:text-red-400 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Below reorder level · Replenishment needed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Within operating stock band
                    </span>
                  )}
                  <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    Avg {formatLitres(product.avgDailyOutflowLitres)}/day
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tank Breakdown Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              {isPetrol ? 'Petrol Underground Tanks' : 'Diesel Underground Tanks'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Book stock vs. last dipstick calibration with quick replenishment and outflow links.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {familyTanks.length} tanks active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 font-semibold">Tank</th>
                <th className="py-3 px-4 font-semibold">Grade</th>
                <th className="py-3 px-4 font-semibold text-right">Book Stock</th>
                <th className="py-3 px-4 font-semibold text-right">Last Dip</th>
                <th className="py-3 px-4 font-semibold text-right">Capacity</th>
                <th className="py-3 px-4 font-semibold text-right">Min Threshold</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                {canMutate && <th className="py-3 px-4 font-semibold text-right">Quick Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {familyTanks.map((tank) => {
                const isLow = tank.currentBookStockLitres < tank.minThresholdLitres;
                const isNear =
                  !isLow && tank.currentBookStockLitres <= tank.minThresholdLitres * 1.25;
                const fillRatio =
                  tank.capacityLitres > 0
                    ? Math.min(100, Math.round((tank.currentBookStockLitres / tank.capacityLitres) * 100))
                    : 0;

                return (
                  <tr key={tank.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-slate-900 dark:text-white">
                        {tank.tankCode}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{tank.tankLabel}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-medium text-slate-800 dark:text-slate-200">
                        {tank.gradeCode}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{tank.productName}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {formatLitres(tank.currentBookStockLitres)}
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                        {fillRatio}% cap
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatLitres(tank.lastDipStockLitres)}
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{tank.lastDipMm} mm</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatLitres(tank.capacityLitres)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatLitres(tank.minThresholdLitres)}
                    </td>
                    <td className="py-3 px-4">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1.5 text-red-700 dark:text-red-400 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Low Stock
                        </span>
                      ) : isNear ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Near Threshold
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Nominal
                        </span>
                      )}
                    </td>
                    {canMutate && (
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onQuickMovement('IN', tank.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                          >
                            <ArrowDownToLine className="w-3 h-3" />
                            Stock In
                          </button>
                          <button
                            type="button"
                            onClick={() => onQuickMovement('OUT', tank.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                          >
                            <ArrowUpFromLine className="w-3 h-3" />
                            Stock Out
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Fuel Family Movements */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            Recent {isPetrol ? 'Petrol' : 'Diesel'} Stock Movements
          </h4>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Latest {familyMovements.length} entries
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4 font-semibold">Date</th>
                <th className="py-2.5 px-4 font-semibold">Tank · Grade</th>
                <th className="py-2.5 px-4 font-semibold">Movement Type</th>
                <th className="py-2.5 px-4 font-semibold">Reference</th>
                <th className="py-2.5 px-4 font-semibold text-right">Volume</th>
                <th className="py-2.5 px-4 font-semibold text-right">Balance After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {familyMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-center text-slate-500 dark:text-slate-400">
                    No {isPetrol ? 'petrol' : 'diesel'} movements recorded yet.
                  </td>
                </tr>
              ) : (
                familyMovements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {mov.movementDate}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">
                      {mov.tankCode} · {mov.gradeCode}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                      {mov.direction === 'IN' ? 'Stock In' : 'Stock Out'} ·{' '}
                      {mov.movementType.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                      {mov.referenceNo}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold ${
                        mov.direction === 'IN'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {mov.direction === 'IN' ? '+' : '-'}
                      {formatLitres(mov.quantityLitres)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatLitres(mov.balanceAfterLitres)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
