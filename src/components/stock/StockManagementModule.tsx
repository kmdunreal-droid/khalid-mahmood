import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Droplets,
  Fuel,
  Gauge,
} from 'lucide-react';
import { db, DEFAULT_STATION_ID } from '../../firebase';
import { ActiveRolePersona } from '../../data/shiftTypes';
import {
  inferFuelFamily,
  INITIAL_DIP_READINGS,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_STOCK_PRODUCTS,
  INITIAL_STORAGE_TANKS,
} from '../../data/stockSeedData';
import {
  DipReadingType,
  FuelProductStock,
  LowStockAlertItem,
  StockDirection,
  StockMovementRecord,
  StockMovementType,
  StorageTankStock,
  TankDipReadingRecord,
} from '../../data/stockTypes';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrors';
import { formatLitres } from '../../utils/shiftMath';
import { useFirebaseAuth } from '../auth/FirebaseProvider';
import { FuelGradeStockTab } from './FuelGradeStockTab';
import { LowStockAlertsTab } from './LowStockAlertsTab';
import { StockMovementTab } from './StockMovementTab';
import { TankMonitoringTab } from './TankMonitoringTab';

type StockSubTab =
  | 'petrol'
  | 'diesel'
  | 'tanks'
  | 'stock_in'
  | 'stock_out'
  | 'alerts';

interface StockManagementModuleProps {
  onNavigateToPurchase?: () => void;
}

function formatTsLabel(ts: unknown): string {
  if (
    ts &&
    typeof ts === 'object' &&
    'toDate' in ts &&
    typeof (ts as { toDate: () => Date }).toDate === 'function'
  ) {
    const d = (ts as { toDate: () => Date }).toDate();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;
}

export const StockManagementModule: React.FC<StockManagementModuleProps> = ({
  onNavigateToPurchase,
}) => {
  const {
    authReady,
    firebaseUser,
    userProfile,
    isBootstrappedOwner,
    activeRole: rolePersona,
  } = useFirebaseAuth();
  const authenticatedRole: ActiveRolePersona | null =
    userProfile?.role ?? (isBootstrappedOwner ? 'OWNER' : null);

  const [activeTab, setActiveTab] = useState<StockSubTab>('petrol');
  const [products, setProducts] = useState<FuelProductStock[]>(INITIAL_STOCK_PRODUCTS);
  const [tanks, setTanks] = useState<StorageTankStock[]>(INITIAL_STORAGE_TANKS);
  const [dipReadings, setDipReadings] = useState<TankDipReadingRecord[]>(INITIAL_DIP_READINGS);
  const [movements, setMovements] = useState<StockMovementRecord[]>(INITIAL_STOCK_MOVEMENTS);
  const [preselectedTankId, setPreselectedTankId] = useState<string | null>(null);
  const [cloudBanner, setCloudBanner] = useState<string | null>(null);

  const effectiveStationId = userProfile?.stationId || DEFAULT_STATION_ID;
  const isLiveCloudActive = Boolean(authReady && firebaseUser && authenticatedRole);
  const canMutate = rolePersona === 'OWNER' || rolePersona === 'MANAGER';

  useEffect(() => {
    if (!isLiveCloudActive || !firebaseUser) return;

    const productsPath = `stations/${effectiveStationId}/products`;
    const unsubProducts = onSnapshot(
      collection(db, 'stations', effectiveStationId, 'products'),
      (snap) => {
        if (snap.empty) return;
        const rows: FuelProductStock[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const sku = String(data.sku ?? d.id);
          const name = String(data.name ?? sku);
          const seedMatch = INITIAL_STOCK_PRODUCTS.find((p) => p.id === d.id || p.sku === sku);
          return {
            id: d.id,
            stationId: String(data.stationId ?? effectiveStationId),
            sku,
            name,
            fuelFamily: inferFuelFamily(`${sku} ${name}`),
            category: (data.category as FuelProductStock['category']) ?? 'FUEL',
            unit: (data.unit as FuelProductStock['unit']) ?? 'LITRE',
            currentSellingPrice: Number(data.currentSellingPrice ?? 0),
            taxRatePct: Number(data.taxRatePct ?? 0),
            reorderLevel: Number(data.reorderLevel ?? 0),
            avgDailyOutflowLitres: seedMatch?.avgDailyOutflowLitres ?? 2000,
            updatedAtLabel: formatTsLabel(data.updatedAt),
          };
        });
        setProducts(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, productsPath)
    );

    const tanksPath = `stations/${effectiveStationId}/tanks`;
    const unsubTanks = onSnapshot(
      collection(db, 'stations', effectiveStationId, 'tanks'),
      (snap) => {
        if (snap.empty) return;
        const rows: StorageTankStock[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const tankCode = String(data.tankCode ?? d.id);
          const productId = String(data.productId ?? 'prod-ms-91');
          const seedTank = INITIAL_STORAGE_TANKS.find(
            (t) => t.id === d.id || t.tankCode === tankCode
          );
          const seedProd = INITIAL_STOCK_PRODUCTS.find((p) => p.id === productId);
          const gradeCode = seedTank?.gradeCode ?? seedProd?.sku ?? 'MS-91';
          const productName = seedTank?.productName ?? seedProd?.name ?? 'Motor Fuel';
          return {
            id: d.id,
            stationId: String(data.stationId ?? effectiveStationId),
            productId,
            tankCode,
            tankLabel: seedTank?.tankLabel ?? `Underground Tank ${tankCode}`,
            fuelFamily: inferFuelFamily(`${gradeCode} ${productName}`),
            gradeCode,
            productName,
            capacityLitres: Number(data.capacityLitres ?? 20000),
            currentBookStockLitres: Number(data.currentBookStockLitres ?? 0),
            lastDipStockLitres: Number(data.lastDipStockLitres ?? 0),
            minThresholdLitres: Number(data.minThresholdLitres ?? 3000),
            lastDipMm: seedTank?.lastDipMm ?? 0,
            lastWaterDipMm: seedTank?.lastWaterDipMm ?? 0,
            densityAt15C: seedTank?.densityAt15C ?? (gradeCode.includes('HSD') ? 0.831 : 0.742),
            updatedAtLabel: formatTsLabel(data.updatedAt),
          };
        });
        rows.sort((a, b) => a.tankCode.localeCompare(b.tankCode));
        setTanks(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, tanksPath)
    );

    let unsubMovements: (() => void) | undefined;
    if (authenticatedRole === 'OWNER' || authenticatedRole === 'MANAGER') {
      const movPath = `stations/${effectiveStationId}/stockMovements`;
      unsubMovements = onSnapshot(
        collection(db, 'stations', effectiveStationId, 'stockMovements'),
        (snap) => {
          if (snap.empty) return;
          const rows: StockMovementRecord[] = snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            const gradeCode = String(data.gradeCode ?? 'MS-91');
            const productName = String(data.productName ?? 'Motor Fuel');
            return {
              id: d.id,
              stationId: String(data.stationId ?? effectiveStationId),
              tankId: String(data.tankId ?? ''),
              tankCode: String(data.tankCode ?? ''),
              productId: String(data.productId ?? ''),
              productName,
              gradeCode,
              fuelFamily: inferFuelFamily(`${gradeCode} ${productName}`),
              direction: (data.direction as StockDirection) ?? 'IN',
              movementType: (data.movementType as StockMovementType) ?? 'TANKER_DECANT',
              quantityLitres: Number(data.quantityLitres ?? 0),
              balanceAfterLitres: Number(data.balanceAfterLitres ?? 0),
              referenceNo: String(data.referenceNo ?? ''),
              densityObserved:
                typeof data.densityObserved === 'number' ? data.densityObserved : undefined,
              notes: data.notes ? String(data.notes) : undefined,
              recordedByUid: String(data.recordedByUid ?? ''),
              recordedByName:
                data.recordedByUid === firebaseUser.uid
                  ? userProfile?.displayName || firebaseUser.email || 'Station User'
                  : 'Station Manager',
              movementDate: String(data.movementDate ?? '2026-11-23'),
              createdAtLabel: formatTsLabel(data.createdAt),
            };
          });
          rows.sort((a, b) => b.createdAtLabel.localeCompare(a.createdAtLabel));
          setMovements(rows);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, movPath)
      );
    }

    return () => {
      unsubProducts();
      unsubTanks();
      if (unsubMovements) unsubMovements();
    };
  }, [isLiveCloudActive, firebaseUser, authenticatedRole, effectiveStationId, userProfile?.displayName]);

  // Listen to tank dipReadings for Owner & Manager when live cloud is active
  useEffect(() => {
    if (
      !isLiveCloudActive ||
      !firebaseUser ||
      (authenticatedRole !== 'OWNER' && authenticatedRole !== 'MANAGER')
    ) {
      return;
    }

    const dipMap = new Map<string, TankDipReadingRecord>();
    const unsubs = tanks.map((tank) => {
      const dipPath = `stations/${effectiveStationId}/tanks/${tank.id}/dipReadings`;
      return onSnapshot(
        collection(db, 'stations', effectiveStationId, 'tanks', tank.id, 'dipReadings'),
        (snap) => {
          snap.docs.forEach((d) => {
            const data = d.data() as Record<string, unknown>;
            dipMap.set(d.id, {
              id: d.id,
              tankId: String(data.tankId ?? tank.id),
              tankCode: tank.tankCode,
              gradeCode: tank.gradeCode,
              shiftId: data.shiftId ? String(data.shiftId) : undefined,
              recordedByUid: String(data.recordedByUid ?? ''),
              recordedByName:
                data.recordedByUid === firebaseUser.uid
                  ? userProfile?.displayName || firebaseUser.email || 'Station User'
                  : 'Station Manager',
              readingType: (data.readingType as DipReadingType) ?? 'AUDIT',
              dipMm: Number(data.dipMm ?? 0),
              waterDipMm: Number(data.waterDipMm ?? 0),
              calculatedVolumeLitres: Number(data.calculatedVolumeLitres ?? 0),
              bookStockLitres: Number(data.bookStockLitres ?? 0),
              varianceLitres: Number(data.varianceLitres ?? 0),
              recordedAtLabel: formatTsLabel(data.recordedAt),
            });
          });
          if (dipMap.size > 0) {
            const sorted = Array.from(dipMap.values()).sort((a, b) =>
              b.recordedAtLabel.localeCompare(a.recordedAtLabel)
            );
            setDipReadings(sorted);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, dipPath)
      );
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [
    isLiveCloudActive,
    firebaseUser,
    authenticatedRole,
    effectiveStationId,
    tanks.map((t) => t.id).join(','),
    userProfile?.displayName,
  ]);

  const kpis = useMemo(() => {
    const petrolStock = tanks
      .filter((t) => t.fuelFamily === 'PETROL')
      .reduce((s, t) => s + t.currentBookStockLitres, 0);
    const petrolCap = tanks
      .filter((t) => t.fuelFamily === 'PETROL')
      .reduce((s, t) => s + t.capacityLitres, 0);
    const dieselStock = tanks
      .filter((t) => t.fuelFamily === 'DIESEL')
      .reduce((s, t) => s + t.currentBookStockLitres, 0);
    const dieselCap = tanks
      .filter((t) => t.fuelFamily === 'DIESEL')
      .reduce((s, t) => s + t.capacityLitres, 0);
    const totalStock = petrolStock + dieselStock;
    const totalCap = petrolCap + dieselCap;
    const totalUllage = Math.max(0, totalCap - totalStock);
    const lowStockCount = tanks.filter(
      (t) => t.currentBookStockLitres < t.minThresholdLitres
    ).length;
    const warningCount = tanks.filter(
      (t) =>
        t.currentBookStockLitres >= t.minThresholdLitres &&
        t.currentBookStockLitres <= t.minThresholdLitres * 1.25
    ).length;

    return {
      petrolStock,
      petrolCap,
      dieselStock,
      dieselCap,
      totalUllage,
      lowStockCount,
      warningCount,
    };
  }, [tanks]);

  const handleUpdateSellingPrice = async (productId: string, newPrice: number) => {
    if (!canMutate) return;
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, currentSellingPrice: newPrice, updatedAtLabel: formatTsLabel(null) } : p
      )
    );

    if (isLiveCloudActive && (authenticatedRole === 'OWNER' || authenticatedRole === 'MANAGER')) {
      const path = `stations/${effectiveStationId}/products/${productId}`;
      try {
        await updateDoc(doc(db, 'stations', effectiveStationId, 'products', productId), {
          currentSellingPrice: newPrice,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    }
  };

  const handleRecordDipReading = async (payload: {
    tankId: string;
    readingType: DipReadingType;
    dipMm: number;
    waterDipMm: number;
    calculatedVolumeLitres: number;
    shiftId?: string;
  }) => {
    if (!canMutate) return;
    const targetTank = tanks.find((t) => t.id === payload.tankId);
    if (!targetTank) return;

    const varianceLitres = +(payload.calculatedVolumeLitres - targetTank.currentBookStockLitres).toFixed(2);
    const dipId = `dip-${Date.now()}`;
    const nowLabel = formatTsLabel(null);
    const actorName = userProfile?.displayName || firebaseUser?.email || rolePersona;

    const newDip: TankDipReadingRecord = {
      id: dipId,
      tankId: targetTank.id,
      tankCode: targetTank.tankCode,
      gradeCode: targetTank.gradeCode,
      shiftId: payload.shiftId,
      recordedByUid: firebaseUser?.uid || rolePersona.toLowerCase(),
      recordedByName: actorName,
      readingType: payload.readingType,
      dipMm: payload.dipMm,
      waterDipMm: payload.waterDipMm,
      calculatedVolumeLitres: payload.calculatedVolumeLitres,
      bookStockLitres: targetTank.currentBookStockLitres,
      varianceLitres,
      recordedAtLabel: nowLabel,
    };

    setDipReadings((prev) => [newDip, ...prev]);
    setTanks((prev) =>
      prev.map((t) =>
        t.id === targetTank.id
          ? {
              ...t,
              lastDipStockLitres: payload.calculatedVolumeLitres,
              lastDipMm: payload.dipMm,
              lastWaterDipMm: payload.waterDipMm,
              updatedAtLabel: nowLabel,
            }
          : t
      )
    );

    if (
      isLiveCloudActive &&
      firebaseUser &&
      (authenticatedRole === 'OWNER' || authenticatedRole === 'MANAGER')
    ) {
      const dipPath = `stations/${effectiveStationId}/tanks/${targetTank.id}/dipReadings/${dipId}`;
      const docData: Record<string, unknown> = {
        tankId: targetTank.id,
        recordedByUid: firebaseUser.uid,
        readingType: payload.readingType,
        dipMm: payload.dipMm,
        waterDipMm: payload.waterDipMm,
        calculatedVolumeLitres: payload.calculatedVolumeLitres,
        bookStockLitres: targetTank.currentBookStockLitres,
        varianceLitres,
        recordedAt: serverTimestamp(),
      };
      if (payload.shiftId) docData.shiftId = payload.shiftId;

      try {
        await setDoc(
          doc(db, 'stations', effectiveStationId, 'tanks', targetTank.id, 'dipReadings', dipId),
          docData
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, dipPath);
      }

      const tankPath = `stations/${effectiveStationId}/tanks/${targetTank.id}`;
      try {
        await updateDoc(doc(db, 'stations', effectiveStationId, 'tanks', targetTank.id), {
          lastDipStockLitres: payload.calculatedVolumeLitres,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, tankPath);
      }
    }
  };

  const handleRecordMovement = async (payload: {
    tankId: string;
    direction: StockDirection;
    movementType: StockMovementType;
    quantityLitres: number;
    referenceNo: string;
    densityObserved?: number;
    notes?: string;
    movementDate: string;
  }) => {
    if (!canMutate) return;
    const targetTank = tanks.find((t) => t.id === payload.tankId);
    if (!targetTank) return;

    const delta = payload.direction === 'IN' ? payload.quantityLitres : -payload.quantityLitres;
    const balanceAfterLitres = Math.max(
      0,
      +(targetTank.currentBookStockLitres + delta).toFixed(2)
    );
    const movId = `stk-mov-${Date.now()}`;
    const nowLabel = formatTsLabel(null);
    const actorName = userProfile?.displayName || firebaseUser?.email || rolePersona;

    const newMovement: StockMovementRecord = {
      id: movId,
      stationId: effectiveStationId,
      tankId: targetTank.id,
      tankCode: targetTank.tankCode,
      productId: targetTank.productId,
      productName: targetTank.productName,
      gradeCode: targetTank.gradeCode,
      fuelFamily: targetTank.fuelFamily,
      direction: payload.direction,
      movementType: payload.movementType,
      quantityLitres: payload.quantityLitres,
      balanceAfterLitres,
      referenceNo: payload.referenceNo,
      densityObserved: payload.densityObserved,
      notes: payload.notes,
      recordedByUid: firebaseUser?.uid || rolePersona.toLowerCase(),
      recordedByName: actorName,
      movementDate: payload.movementDate,
      createdAtLabel: nowLabel,
    };

    setMovements((prev) => [newMovement, ...prev]);
    setTanks((prev) =>
      prev.map((t) =>
        t.id === targetTank.id
          ? {
              ...t,
              currentBookStockLitres: balanceAfterLitres,
              densityAt15C: payload.densityObserved ?? t.densityAt15C,
              updatedAtLabel: nowLabel,
            }
          : t
      )
    );

    if (
      isLiveCloudActive &&
      firebaseUser &&
      (authenticatedRole === 'OWNER' || authenticatedRole === 'MANAGER')
    ) {
      const movPath = `stations/${effectiveStationId}/stockMovements/${movId}`;
      const movDoc: Record<string, unknown> = {
        stationId: effectiveStationId,
        tankId: targetTank.id,
        tankCode: targetTank.tankCode,
        productId: targetTank.productId,
        productName: targetTank.productName,
        gradeCode: targetTank.gradeCode,
        direction: payload.direction,
        movementType: payload.movementType,
        quantityLitres: payload.quantityLitres,
        balanceAfterLitres,
        referenceNo: payload.referenceNo,
        recordedByUid: firebaseUser.uid,
        movementDate: payload.movementDate,
        createdAt: serverTimestamp(),
      };
      if (typeof payload.densityObserved === 'number') {
        movDoc.densityObserved = payload.densityObserved;
      }
      if (payload.notes) {
        movDoc.notes = payload.notes;
      }

      try {
        await setDoc(doc(db, 'stations', effectiveStationId, 'stockMovements', movId), movDoc);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, movPath);
      }

      const tankPath = `stations/${effectiveStationId}/tanks/${targetTank.id}`;
      try {
        await updateDoc(doc(db, 'stations', effectiveStationId, 'tanks', targetTank.id), {
          currentBookStockLitres: balanceAfterLitres,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, tankPath);
      }
    }
  };

  const handleUpdateThreshold = async (tankId: string, newThresholdLitres: number) => {
    if (!canMutate) return;
    setTanks((prev) =>
      prev.map((t) =>
        t.id === tankId
          ? { ...t, minThresholdLitres: newThresholdLitres, updatedAtLabel: formatTsLabel(null) }
          : t
      )
    );

    if (isLiveCloudActive && (authenticatedRole === 'OWNER' || authenticatedRole === 'MANAGER')) {
      const tankPath = `stations/${effectiveStationId}/tanks/${tankId}`;
      try {
        await updateDoc(doc(db, 'stations', effectiveStationId, 'tanks', tankId), {
          minThresholdLitres: newThresholdLitres,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, tankPath);
      }
    }
  };

  const handleDispatchLowStockAlert = async (alertItem: LowStockAlertItem) => {
    const { tank, severity, estimatedDaysRemaining, recommendedOrderLitres } = alertItem;
    const title = `Low Stock ${severity}: ${tank.tankCode} (${tank.gradeCode})`;
    const message = `${tank.tankCode} ${tank.productName} is at ${formatLitres(
      tank.currentBookStockLitres
    )} (min ${formatLitres(tank.minThresholdLitres)}). Est. ${estimatedDaysRemaining} days runway; suggested order ${formatLitres(
      recommendedOrderLitres
    )}.`;

    if (isLiveCloudActive && firebaseUser) {
      const notifId = `notif-stk-${Date.now()}`;
      const notifPath = `stations/${effectiveStationId}/notifications/${notifId}`;
      try {
        await setDoc(doc(db, 'stations', effectiveStationId, 'notifications', notifId), {
          stationId: effectiveStationId,
          recipientUid: firebaseUser.uid,
          severity: severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
          eventType: 'LOW_STOCK_ALERT',
          title: title.slice(0, 160),
          message: message.slice(0, 500),
          isRead: false,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, notifPath);
      }
    }
    setCloudBanner(`Owner alert dispatched: ${title}`);
  };

  const handleQuickMovement = (direction: StockDirection, tankId: string) => {
    setPreselectedTankId(tankId);
    setActiveTab(direction === 'IN' ? 'stock_in' : 'stock_out');
  };

  const tabs: { id: StockSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'petrol', label: 'Petrol Stock', icon: <Fuel className="w-3.5 h-3.5" /> },
    { id: 'diesel', label: 'Diesel Stock', icon: <Droplets className="w-3.5 h-3.5" /> },
    { id: 'tanks', label: 'Tank Monitoring', icon: <Gauge className="w-3.5 h-3.5" /> },
    { id: 'stock_in', label: 'Stock In', icon: <ArrowDownToLine className="w-3.5 h-3.5" /> },
    { id: 'stock_out', label: 'Stock Out', icon: <ArrowUpFromLine className="w-3.5 h-3.5" /> },
    {
      id: 'alerts',
      label: `Low Stock Alerts (${kpis.lowStockCount + kpis.warningCount})`,
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Stock & Tanks</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Petrol & Diesel inventory, tank dip monitoring, stock movements, and low-stock alerts
            </p>
          </div>
          {cloudBanner && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {cloudBanner}
            </span>
          )}
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Petrol Stock</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {formatLitres(kpis.petrolStock)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
            of {formatLitres(kpis.petrolCap)} capacity
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Diesel Stock</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {formatLitres(kpis.dieselStock)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
            of {formatLitres(kpis.dieselCap)} capacity
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Available Ullage</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {formatLitres(kpis.totalUllage)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Tanker decanting space
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Low Stock Alerts</div>
          <div
            className={`text-xl font-bold font-mono tabular-nums mt-1 ${
              kpis.lowStockCount > 0
                ? 'text-red-600 dark:text-red-400'
                : kpis.warningCount > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {kpis.lowStockCount} Critical · {kpis.warningCount} Near
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Minimum reserve status
          </div>
        </div>
      </div>

      {/* 6 Sub-Module Navigation Tabs */}
      <div className="bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 flex flex-wrap gap-1 w-fit max-w-full overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[38px] inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Sub-Module Content */}
      {activeTab === 'petrol' && (
        <FuelGradeStockTab
          fuelFamily="PETROL"
          products={products}
          tanks={tanks}
          movements={movements}
          canMutate={canMutate}
          onUpdateSellingPrice={handleUpdateSellingPrice}
          onQuickMovement={handleQuickMovement}
        />
      )}

      {activeTab === 'diesel' && (
        <FuelGradeStockTab
          fuelFamily="DIESEL"
          products={products}
          tanks={tanks}
          movements={movements}
          canMutate={canMutate}
          onUpdateSellingPrice={handleUpdateSellingPrice}
          onQuickMovement={handleQuickMovement}
        />
      )}

      {activeTab === 'tanks' && (
        <TankMonitoringTab
          tanks={tanks}
          dipReadings={dipReadings}
          canMutate={canMutate}
          onRecordDipReading={handleRecordDipReading}
        />
      )}

      {activeTab === 'stock_in' && (
        <StockMovementTab
          direction="IN"
          tanks={tanks}
          movements={movements}
          rolePersona={rolePersona}
          canMutate={canMutate}
          preselectedTankId={preselectedTankId}
          onRecordMovement={handleRecordMovement}
        />
      )}

      {activeTab === 'stock_out' && (
        <StockMovementTab
          direction="OUT"
          tanks={tanks}
          movements={movements}
          rolePersona={rolePersona}
          canMutate={canMutate}
          preselectedTankId={preselectedTankId}
          onRecordMovement={handleRecordMovement}
        />
      )}

      {activeTab === 'alerts' && (
        <LowStockAlertsTab
          tanks={tanks}
          products={products}
          canMutate={canMutate}
          onUpdateThreshold={handleUpdateThreshold}
          onDispatchLowStockAlert={handleDispatchLowStockAlert}
          onNavigateToPurchase={onNavigateToPurchase}
        />
      )}
    </div>
  );
};
