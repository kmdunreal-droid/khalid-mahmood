import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Clock,
  FileBarChart2,
  Fuel,
  Gauge,
  KeyRound,
  LayoutDashboard,
  Menu,
  Moon,
  PackageCheck,
  Sun,
  UserCheck,
  X,
} from 'lucide-react';
import { AccountingModule } from './components/accounting/AccountingModule';
import { useFirebaseAuth } from './components/auth/FirebaseProvider';
import { LoginAuthModule } from './components/auth/LoginAuthModule';
import { DashboardsHub } from './components/dashboards/DashboardsHub';
import { ArchitectureTab } from './components/OverviewSection';
import { PurchaseManagementModule } from './components/purchase/PurchaseManagementModule';
import { ReportingModule } from './components/reports/ReportingModule';
import { SalesManagementModule } from './components/sales/SalesManagementModule';
import { ShiftManagementModule } from './components/shift/ShiftManagementModule';
import { StockManagementModule } from './components/stock/StockManagementModule';
import { OfflineSyncStatusBadge } from './components/common/OfflineSyncStatusBadge';
import { OfflineBanner } from './components/common/OfflineBanner';
import { PWAInstallButton } from './components/common/PWAInstallButton';
import { RoleId } from './data/types';

const NAV_ITEMS: { id: ArchitectureTab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboards', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'shift_module', label: 'Shifts', icon: <Clock className="w-4 h-4" /> },
  { id: 'sales_module', label: 'Sales', icon: <Fuel className="w-4 h-4" /> },
  { id: 'stock_module', label: 'Stock', icon: <Gauge className="w-4 h-4" /> },
  { id: 'purchase_module', label: 'Purchases', icon: <PackageCheck className="w-4 h-4" /> },
  { id: 'accounting_module', label: 'Accounting', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'reports_module', label: 'Reports', icon: <FileBarChart2 className="w-4 h-4" /> },
  { id: 'auth_module', label: 'Staff & Login', icon: <KeyRound className="w-4 h-4" /> },
];

const ROLE_OPTIONS: { id: RoleId; label: string }[] = [
  { id: 'OWNER', label: 'Owner' },
  { id: 'MANAGER', label: 'Manager' },
  { id: 'OPERATOR', label: 'Operator' },
];

export default function App() {
  const { firebaseUser, userProfile, activeRole, setActiveRole, isRoleLocked } =
    useFirebaseAuth();
  const [activeTab, setActiveTab] = useState<ArchitectureTab>('dashboards');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('petrolops-theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('petrolops-theme', theme);
    } catch {
      // Ignore storage failures
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleNavigate = (tab: ArchitectureTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentNavLabel =
    NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? 'Dashboard';

  const accountButtonLabel = firebaseUser
    ? userProfile?.displayName?.split(' ')[0] || activeRole
    : 'Sign In';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row transition-colors duration-200">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-30">
        <div className="h-14 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center">
          <button
            type="button"
            onClick={() => handleNavigate('dashboards')}
            className="inline-flex items-center gap-2 text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            <Fuel className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>
              PetrolOps <span className="text-blue-600 dark:text-emerald-400">Studio</span>
            </span>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full min-h-[40px] flex items-center gap-3 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors text-left whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className={isActive ? 'text-emerald-200' : 'text-slate-400 dark:text-slate-500'}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          {!isRoleLocked && (
            <div>
              <div className="px-1 pb-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Active View
              </div>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                {ROLE_OPTIONS.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setActiveRole(role.id)}
                    className={`min-h-[32px] text-[11px] font-semibold rounded-md transition-colors ${
                      activeRole === role.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleToggleTheme}
            className="w-full min-h-[40px] flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-emerald-400" />
            ) : (
              <Moon className="w-4 h-4 text-blue-700" />
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white dark:bg-slate-900 h-full border-r border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="h-14 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-base font-bold text-slate-900 dark:text-white">
                PetrolOps <span className="text-blue-600 dark:text-emerald-400">Studio</span>
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2 text-xs font-semibold rounded-lg text-left ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              {!isRoleLocked && (
                <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  {ROLE_OPTIONS.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setActiveRole(role.id)}
                      className={`min-h-[36px] text-xs font-semibold rounded-md transition-colors ${
                        activeRole === role.id
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleToggleTheme}
                className="w-full min-h-[44px] flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              >
                <span>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Moon className="w-4 h-4 text-blue-700" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-60 print:pl-0 flex flex-col min-w-0">
        {/* Clean 3-Zone Top Header */}
        <header className="h-12 lg:h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden min-h-[40px] min-w-[40px] inline-flex items-center justify-center -ml-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-md"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
              <span className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                PetrolOps Studio
              </span>
              <span aria-hidden="true">/</span>
              <span className="text-slate-600 dark:text-slate-300 truncate">{currentNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <OfflineSyncStatusBadge />
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => handleNavigate('auth_module')}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{accountButtonLabel}</span>
            </button>
          </div>
        </header>

        <OfflineBanner />

        <main className="flex-1 p-3 sm:p-6 lg:p-8 pb-16 lg:pb-8 max-w-[1440px] w-full mx-auto">
          {activeTab === 'dashboards' && <DashboardsHub onNavigateTab={handleNavigate} />}
          {activeTab === 'auth_module' && <LoginAuthModule />}
          {activeTab === 'shift_module' && <ShiftManagementModule />}
          {activeTab === 'purchase_module' && <PurchaseManagementModule />}
          {activeTab === 'sales_module' && <SalesManagementModule />}
          {activeTab === 'stock_module' && (
            <StockManagementModule onNavigateToPurchase={() => handleNavigate('purchase_module')} />
          )}
          {activeTab === 'accounting_module' && (
            <AccountingModule onNavigateToPurchase={() => handleNavigate('purchase_module')} />
          )}
          {activeTab === 'reports_module' && <ReportingModule />}
        </main>
      </div>

      {/* Mobile Fixed Thumb-Zone Bottom Bar */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-12 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center no-print"
      >
        {[
          { id: 'dashboards' as const, label: 'Home', icon: <LayoutDashboard className="w-4 h-4" /> },
          { id: 'shift_module' as const, label: 'Shifts', icon: <Clock className="w-4 h-4" /> },
          { id: 'sales_module' as const, label: 'Sales', icon: <Fuel className="w-4 h-4" /> },
          { id: 'reports_module' as const, label: 'Reports', icon: <FileBarChart2 className="w-4 h-4" /> },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleNavigate(tab.id)}
              className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                isActive
                  ? 'text-blue-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400"
        >
          <Menu className="w-4 h-4" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
