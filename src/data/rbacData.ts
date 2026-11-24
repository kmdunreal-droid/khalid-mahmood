import { ModulePermissionSpec, RoleId, SystemModule } from './types';

export const SYSTEM_MODULES: SystemModule[] = [
  {
    id: 'authentication',
    name: 'Authentication',
    domain: 'Core & Security',
    summary: 'Multi-station JWT auth, refresh token rotation, role claims, and immutable audit logging.',
    primaryTables: ['stations', 'users', 'user_sessions', 'audit_logs'],
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    domain: 'Finance & Analytics',
    summary: 'Real-time forecourt throughput, tank dip levels, shift cash reconciliation, and margin KPIs.',
    primaryTables: ['vw_daily_shift_summary', 'vw_stock_reconciliation'],
  },
  {
    id: 'shift_management',
    name: 'Shift Management',
    domain: 'Forecourt Operations',
    summary: 'Morning/Evening/Night shift lifecycle, nozzle assignments, meter readings, and cash variance checks.',
    primaryTables: ['shifts', 'shift_nozzle_assignments', 'shift_settlements'],
  },
  {
    id: 'purchase_management',
    name: 'Purchase Management',
    domain: 'Inventory & Supply',
    summary: 'OMC fuel indents, tanker receipt verification, density/temp checks, and compartment unloading.',
    primaryTables: ['suppliers', 'purchase_orders', 'fuel_deliveries', 'fuel_delivery_items'],
  },
  {
    id: 'sales_management',
    name: 'Sales Management',
    domain: 'Forecourt Operations',
    summary: 'Nozzle cash/UPI/card POS billing, lubricant retail sales, and fleet credit slip issuance.',
    primaryTables: ['sales_transactions', 'sales_line_items'],
  },
  {
    id: 'stock_management',
    name: 'Stock Management',
    domain: 'Inventory & Supply',
    summary: 'Underground tank book vs. physical dip reconciliation, calibration charts, and fuel price revisions.',
    primaryTables: ['fuel_products', 'fuel_price_history', 'storage_tanks', 'dispensers', 'nozzles', 'tank_dip_readings'],
  },
  {
    id: 'employee_management',
    name: 'Employee Management',
    domain: 'Core & Security',
    summary: 'Attendant & supervisor profiles, shift roster eligibility, daily attendance, and payroll base rates.',
    primaryTables: ['employees', 'employee_attendance'],
  },
  {
    id: 'customer_credit',
    name: 'Customer Credit Management',
    domain: 'Finance & Analytics',
    summary: 'B2B fleet accounts, authorized vehicle whitelists, credit limit enforcement, and settlement ledgers.',
    primaryTables: ['credit_customers', 'customer_vehicles', 'credit_ledger', 'credit_payments'],
  },
  {
    id: 'accounting',
    name: 'Accounting',
    domain: 'Finance & Analytics',
    summary: 'Double-entry chart of accounts, automated shift/purchase journal postings, and station petty expenses.',
    primaryTables: ['chart_of_accounts', 'journal_entries', 'journal_lines', 'operating_expenses'],
  },
  {
    id: 'reports',
    name: 'Reports',
    domain: 'Finance & Analytics',
    summary: 'DSR (Daily Sales Register), stock gain/loss, credit aging, GST/tax summaries, and PDF/XLSX exports.',
    primaryTables: ['report_exports', 'vw_credit_aging', 'vw_profit_and_loss'],
  },
  {
    id: 'notifications',
    name: 'Notifications',
    domain: 'Core & Security',
    summary: 'Threshold alerts for low tank stock, cash variance breaches, tanker shortages, and overdue credit.',
    primaryTables: ['notification_rules', 'notifications'],
  },
];

export const ROLE_PROFILES: Record<
  RoleId,
  {
    title: string;
    scope: string;
    hierarchyLevel: number;
    summary: string;
    authPolicy: string;
    keyResponsibilities: string[];
  }
> = {
  OWNER: {
    title: 'Owner',
    scope: 'Multi-Station Global',
    hierarchyLevel: 1,
    summary: 'Full governance across all owned stations, financial books, fuel pricing, user provisioning, and final period locks.',
    authPolicy: 'MFA Mandatory · Hardware/TOTP + IP Audit · Can impersonate read-only view per station',
    keyResponsibilities: [
      'Approve fuel price revisions, supplier contracts, and credit limits',
      'Review consolidated Profit & Loss, tax filings, and multi-station cash flow',
      'Provision Managers, revoke sessions, and unlock verified shifts if audited',
    ],
  },
  MANAGER: {
    title: 'Manager',
    scope: 'Assigned Station Wide',
    hierarchyLevel: 2,
    summary: 'Day-to-day station supervisor managing shifts, tanker decanting, physical dip verification, credit collections, and staff rosters.',
    authPolicy: 'Email/Phone + Password + Device Binding · Station-isolated JWT tenant claim',
    keyResponsibilities: [
      'Open, verify, and settle forecourt shifts; investigate cash or meter variances',
      'Receive OMC fuel tankers, record pre/post-decant dip readings, and log shortages',
      'Onboard operators, mark attendance, record credit customer repayments, and approve petty expenses',
    ],
  },
  OPERATOR: {
    title: 'Operator',
    scope: 'Active Assigned Shift Only',
    hierarchyLevel: 3,
    summary: 'Forecourt pump attendant operating assigned nozzles, issuing cash/digital/credit receipts, and submitting closing meter totals.',
    authPolicy: 'Employee Code + 6-digit PIN / Password · Restricted to POS & active shift window',
    keyResponsibilities: [
      'Record opening/closing nozzle meter totalizer readings for assigned islands',
      'Issue retail fuel, lubricant, and authorized fleet credit slips',
      'Declare shift cash drop, card/UPI batch totals, and submit shift for Manager verification',
    ],
  },
};

export const RBAC_MATRIX: ModulePermissionSpec[] = [
  {
    moduleId: 'authentication',
    moduleName: 'Authentication',
    dataScopeSummary: {
      owner: 'All stations & all user accounts',
      manager: 'Assigned station Operators only',
      operator: 'Self session & PIN reset only',
    },
    capabilities: [
      {
        action: 'Create / Disable Manager & Operator Accounts',
        owner: { level: 'FULL', rule: 'All roles across all stations' },
        manager: { level: 'SCOPED', rule: 'Operator accounts in own station only' },
        operator: { level: 'NONE', rule: 'Denied' },
      },
      {
        action: 'Force Revoke Active Sessions',
        owner: { level: 'FULL', rule: 'Any user globally' },
        manager: { level: 'SCOPED', rule: 'Operators in own station' },
        operator: { level: 'SCOPED', rule: 'Own active sessions only' },
      },
      {
        action: 'Inspect Security Audit Logs',
        owner: { level: 'READ_ONLY', rule: 'Immutable full audit trail' },
        manager: { level: 'SCOPED', rule: 'Station operational events only' },
        operator: { level: 'NONE', rule: 'Denied' },
      },
    ],
  },
  {
    moduleId: 'dashboard',
    moduleName: 'Dashboard',
    dataScopeSummary: {
      owner: 'Consolidated multi-station P&L & live telemetry',
      manager: 'Single-station operational & cash telemetry',
      operator: 'Personal active shift meter & sales counter',
    },
    capabilities: [
      {
        action: 'View Revenue, Margin & Net Profit KPIs',
        owner: { level: 'FULL', rule: 'All stations + comparative drilldown' },
        manager: { level: 'SCOPED', rule: 'Gross revenue & volume only (no owner net margin)' },
        operator: { level: 'NONE', rule: 'Denied' },
      },
      {
        action: 'View Live Tank Dip & Nozzle Status',
        owner: { level: 'READ_ONLY', rule: 'All stations' },
        manager: { level: 'READ_ONLY', rule: 'Assigned station' },
        operator: { level: 'SCOPED', rule: 'Assigned nozzles only' },
      },
    ],
  },
  {
    moduleId: 'shift_management',
    moduleName: 'Shift Management',
    dataScopeSummary: {
      owner: 'All shifts across stations + unlock override',
      manager: { toString: () => 'All shifts in assigned station' } as never,
      operator: 'Only shifts with active assignment',
    } as never,
    capabilities: [
      {
        action: 'Open Shift & Assign Operators to Nozzles',
        owner: { level: 'FULL', rule: 'Any station' },
        manager: { level: 'FULL', rule: 'Assigned station' },
        operator: { level: 'NONE', rule: 'Cannot open shift independently' },
      },
      {
        action: 'Submit Closing Meter & Cash Drop Declaration',
        owner: { level: 'FULL', rule: 'Override allowed' },
        manager: { level: 'FULL', rule: 'Can enter on behalf of attendant' },
        operator: { level: 'SCOPED', rule: 'Own assigned nozzles while shift is OPEN' },
      },
      {
        action: 'Verify Settlement & Lock Shift',
        owner: { level: 'APPROVE', rule: 'Can unlock & re-verify locked shifts' },
        manager: { level: 'APPROVE', rule: 'Verifies SUBMITTED -> VERIFIED (cannot unlock)' },
        operator: { level: 'NONE', rule: 'Denied' },
      },
    ],
  },
  {
    moduleId: 'purchase_management',
    moduleName: 'Purchase Management',
    dataScopeSummary: {
      owner: 'All suppliers, POs & tanker invoices',
      manager: 'Station POs & tanker receipt verification',
      operator: 'No access',
    },
    capabilities: [
      {
        action: 'Manage Suppliers & OMC Credit Terms',
        owner: { level: 'FULL', rule: 'Create, edit, deactivate' },
        manager: { level: 'READ_ONLY', rule: 'View approved vendor list' },
        operator: { level: 'NONE', rule: 'Denied' },
      },
      {
        action: 'Create & Approve Fuel Purchase Orders',
        owner: { level: 'FULL', rule: 'Unlimited indent value' },
        manager: { level: 'SCOPED', rule: 'Create draft PO; approve up to station limit' },
        operator: { level: 'NONE', rule: 'Denied' },
      },
      {
        action: 'Record Tanker Unloading, Density & Shortage',
        owner: { level: 'FULL', rule: 'Full override' },
        manager: { level: 'FULL', rule: 'Mandatory pre/post dip capture' },
        operator: { level: 'NONE', rule: 'Denied' },
      },
    ],
  },
  {
    moduleId: 'sales_management',
    moduleName: 'Sales Management',
    dataScopeSummary: {
      owner: 'All station receipts & void approvals',
      manager: 'Station receipts, void within 24h',
      operator: 'Create sales in active assigned shift',
    },
    capabilities: [
      {
        action: 'Issue Retail Cash / Card / UPI / Lubricant Sale',
        owner: { level: 'FULL', rule: 'All stations' },
        manager: { level: 'FULL', rule: 'Assigned station' },
        operator: { level: 'SCOPED', rule: 'Active OPEN shift only' },
      },
      {
        action: 'Issue Fleet Credit Slip',
        owner: { level: 'FULL', rule: 'Can override soft hold' },
        manager: { level: 'FULL', rule: 'Within customer credit limit' },
        operator: { level: 'SCOPED', rule: 'Active customer + whitelisted vehicle + within limit' },
      },
      {
        action: 'Void / Reverse Posted Receipt',
        owner: { level: 'APPROVE', rule: 'Any period via reversal journal' },
        manager: { level: 'SCOPED', rule: 'Before shift is LOCKED' },
        operator: { level: 'NONE', rule: 'Must request Manager void' },
      },
    ],
  },
  {
    moduleId: 'stock_management',
    moduleName: 'Stock Management',
    dataScopeSummary: {
      owner: 'Tank calibration, pricing & stock write-offs',
      manager: 'Dip readings & daily stock reconciliation',
      operator: 'View current pump rate only',
    },
    capabilities: [
      {
        action: 'Update Daily Fuel Selling Prices',
        owner: { level: 'FULL', rule: 'Effective-dated price revisions' },
        manager: { level: 'SCOPED', rule: 'Can schedule OMC rate update if delegated' },
        operator: { level: 'READ_ONLY', rule: 'Read active nozzle rate only' },
      },
      {
        action: 'Record Physical Tank Dip & Water Cut',
        owner: { level: 'FULL', rule: 'All tanks' },
        manager: { level: 'FULL', rule: 'Shift open/close & tanker decant dips' },
        operator: { level: 'NONE', rule: 'Denied' },
      },
      {
        action: 'Approve Evaporation / Gain-Loss Adjustment',
        owner: { level: 'APPROVE', rule: 'Posts inventory adjustment journal' },
        manager: { level: 'SCOPED', rule: 'Within ±0.5% tolerance; else escalates' },
        operator: { level: 'NONE', rule: 'Denied' },
      },
    ],
  },
  {
    moduleId: 'employee_management',
    moduleName: 'Employee Management',
    dataScopeSummary: {
      owner: 'Full HR, salary structures & termination',
      manager: 'Operator attendance & shift scheduling',
      operator: 'View own profile & attendance log',
    },
    capabilities: [
      {
        action: 'Edit Salary, Commission & Bank Details',
        owner: { level: 'FULL', rule: 'All staff' },
        manager: { level: 'NONE', rule: 'Masked from Manager view' },
        operator: { level: 'SCOPED', rule: 'Read own payslip summary only' },
      },
      {
        action: 'Mark Daily Attendance & Overtime',
        owner: { level: 'FULL', rule: 'All staff' },
        manager: { level: 'SCOPED', rule: 'Operators in own station' },
        operator: { level: 'SCOPED', rule: 'Read own attendance history' },
      },
    ],
  },
  {
    moduleId: 'customer_credit',
    moduleName: 'Customer Credit Management',
    dataScopeSummary: {
      owner: 'Credit limits, write-offs & legal holds',
      manager: 'Vehicle onboarding, billing & collections',
      operator: 'Verify vehicle plate & credit balance eligibility',
    },
    capabilities: [
      {
        action: 'Approve Credit Customer & Set Credit Limit',
        owner: { level: 'APPROVE', rule: 'Unlimited credit cap' },
        manager: { level: 'SCOPED', rule: 'Propose account; cap up to station policy' },
        operator: { level: 'NONE', rule: 'Denied' },
      },
      {
        action: 'Manage Authorized Fleet Vehicles',
        owner: { level: 'FULL', rule: 'All customers' },
        manager: { level: 'FULL', rule: 'Station customers' },
        operator: { level: 'READ_ONLY', rule: 'Lookup active plate & fuel type at pump' },
      },
      {
        action: 'Record Credit Repayment / Settlement',
        owner: { level: 'FULL', rule: 'All payment methods + bad debt write-off' },
        manager: { level: 'FULL', rule: 'Cash/Cheque/Bank receipt posting' },
        operator: { level: 'NONE', rule: 'Denied' },
      },
    ],
  },
  {
    moduleId: 'accounting',
    moduleName: 'Accounting',
    dataScopeSummary: {
      owner: 'Full GL, Chart of Accounts & period close',
      manager: 'Petty cash expenses & shift vouchers',
      operator: 'No access',
    },
    capabilities: [
      {
        action: 'Manage Chart of Accounts & Manual Journals',
        owner: { level: 'FULL', rule: 'Create accounts, post/reverse journals' },
        manager: { level: 'NONE', rule: 'Automated system postings only' },
        operator: { level: 'NONE', rule: 'Denied' },
      },
      {
        action: 'Log & Approve Station Operating Expenses',
        owner: { level: 'APPROVE', rule: 'All categories & amounts' },
        manager: { level: 'SCOPED', rule: 'Log petty cash; approve under station cap' },
        operator: { level: 'NONE', rule: 'Denied' },
      },
    ],
  },
  {
    moduleId: 'reports',
    moduleName: 'Reports',
    dataScopeSummary: {
      owner: 'All financial, tax & multi-station exports',
      manager: 'DSR, stock dip & credit aging for own station',
      operator: 'Own shift handover slip only',
    },
    capabilities: [
      {
        action: 'Generate Profit & Loss, Balance Sheet & Tax Registers',
        owner: { level: 'FULL', rule: 'PDF/CSV/XLSX across all stations' },
        manager: { level: 'NONE', rule: 'Excluded from P&L margins' },
        operator: { level: 'NONE', rule: 'Denied' },
      },
      {
        action: 'Export Daily Sales Register (DSR) & Stock Reconciliation',
        owner: { level: 'FULL', rule: 'All stations' },
        manager: { level: 'FULL', rule: 'Assigned station' },
        operator: { level: 'SCOPED', rule: 'Own shift summary print only' },
      },
    ],
  },
  {
    moduleId: 'notifications',
    moduleName: 'Notifications',
    dataScopeSummary: {
      owner: 'Configure alert thresholds & receive critical escalations',
      manager: 'Receive operational & variance alerts',
      operator: 'Receive shift assignment & credit hold alerts',
    },
    capabilities: [
      {
        action: 'Configure Alert Threshold Rules',
        owner: { level: 'FULL', rule: 'Tank min level, variance tolerance, overdue days' },
        manager: { level: 'READ_ONLY', rule: 'View station thresholds' },
        operator: { level: 'NONE', rule: 'Denied' },
      },
      {
        action: 'Acknowledge & Resolve Operational Alerts',
        owner: { level: 'FULL', rule: 'All alerts' },
        manager: { level: 'SCOPED', rule: 'Station tank, shift & credit alerts' },
        operator: { level: 'SCOPED', rule: 'Read personal shift notices only' },
      },
    ],
  },
];

// Clean fix for shift_management dataScopeSummary string
RBAC_MATRIX[2].dataScopeSummary = {
  owner: 'All shifts across stations + unlock override',
  manager: 'All shifts in assigned station',
  operator: 'Only shifts with active assignment',
};
