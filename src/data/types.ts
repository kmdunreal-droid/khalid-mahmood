export type RoleId = 'OWNER' | 'MANAGER' | 'OPERATOR';

export type ModuleId =
  | 'authentication'
  | 'dashboard'
  | 'shift_management'
  | 'purchase_management'
  | 'sales_management'
  | 'stock_management'
  | 'employee_management'
  | 'customer_credit'
  | 'accounting'
  | 'reports'
  | 'notifications';

export interface SystemModule {
  id: ModuleId;
  name: string;
  domain: 'Core & Security' | 'Forecourt Operations' | 'Inventory & Supply' | 'Finance & Analytics';
  summary: string;
  primaryTables: string[];
}

export type KeyType = 'PK' | 'FK' | 'UK' | 'IDX';

export interface TableColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  key?: KeyType;
  references?: string;
  defaultValue?: string;
  description: string;
}

export interface TableIndex {
  name: string;
  columns: string[];
  unique?: boolean;
}

export interface DatabaseTable {
  id: string;
  name: string;
  moduleId: ModuleId;
  domain: 'Core & Security' | 'Forecourt Operations' | 'Inventory & Supply' | 'Finance & Analytics';
  description: string;
  estimatedGrowth: string;
  columns: TableColumn[];
  indexes: TableIndex[];
  collectionPath: string;
  collectionModel: 'Root Collection' | 'Subcollection' | 'Embedded Array';
  partitionKey: string;
  sampleDocument: Record<string, unknown>;
  erdPosition: { x: number; y: number };
}

export interface TableRelationship {
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  cardinality: '1:1' | '1:N' | 'N:1' | 'N:M';
  onDelete: 'CASCADE' | 'RESTRICT' | 'SET NULL';
  label: string;
}

export interface SqlEnumDef {
  name: string;
  values: string[];
  description: string;
}

export interface SqlViewDef {
  name: string;
  moduleId: ModuleId;
  purpose: string;
  sourceTables: string[];
  sql: string;
}

export type AccessLevel = 'FULL' | 'SCOPED' | 'READ_ONLY' | 'APPROVE' | 'NONE';

export interface ModulePermissionSpec {
  moduleId: ModuleId;
  moduleName: string;
  capabilities: {
    action: string;
    owner: { level: AccessLevel; rule: string };
    manager: { level: AccessLevel; rule: string };
    operator: { level: AccessLevel; rule: string };
  }[];
  dataScopeSummary: {
    owner: string;
    manager: string;
    operator: string;
  };
}

export interface WorkflowNode {
  id: string;
  stepNumber: string;
  title: string;
  actor: RoleId | 'SYSTEM';
  moduleId: ModuleId;
  nodeType: 'start' | 'process' | 'decision' | 'system' | 'end';
  x: number;
  y: number;
  description: string;
  tablesTouched: string[];
  guardRule: string;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  variant?: 'normal' | 'branch' | 'alert';
}

export interface WorkflowDiagram {
  id: string;
  title: string;
  subtitle: string;
  trigger: string;
  slaOrInvariant: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
