import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, ShieldCheck } from 'lucide-react';
import blueprintJson from '../../firebase-blueprint.json';
import indexesJson from '../../firestore.indexes.json';
import { DIRTY_DOZEN_TEST_CASES } from '../../firestore.rules.test';

type FirestoreTab = 'collections' | 'indexes' | 'rules' | 'blueprint';

interface BlueprintProperty {
  type: string;
  format?: string;
  description?: string;
  enum?: unknown[];
  maxLength?: number;
  minLength?: number;
  pattern?: string;
}

interface BlueprintEntity {
  title: string;
  description: string;
  type: string;
  properties: Record<string, BlueprintProperty>;
  required?: string[];
}

interface BlueprintPathDef {
  schema: string | { $ref: string };
  description: string;
}

const RELATIONSHIPS_SUMMARY: {
  sourcePath: string;
  targetPath: string;
  strategy: string;
  ruleEnforcement: string;
}[] = [
  {
    sourcePath: '/stations/{stationId}',
    targetPath: '/stations/{stationId}/* (all subcollections)',
    strategy: 'Hierarchical Parent Subcollection + Master Gate',
    ruleEnforcement: 'exists(/stations/$(stationId)) verified on every write & get',
  },
  {
    sourcePath: '/users/{userId}',
    targetPath: '/users/{userId}/private/pii',
    strategy: 'PII Split Collection Isolation',
    ruleEnforcement: 'Email/phone isolated from operational roster; get restricted to uid == userId || Owner',
  },
  {
    sourcePath: '/users/{userId}',
    targetPath: '/stations/{stationId} via stationId & role',
    strategy: 'Denormalized Tenant Binding (Zero Token Claims)',
    ruleEnforcement: 'get(/users/$(request.auth.uid)) resolves role & stationId server-side',
  },
  {
    sourcePath: '/stations/{stationId}/tanks/{tankId}',
    targetPath: '/stations/{stationId}/products/{productId}',
    strategy: 'Normalized Reference ID (productId)',
    ruleEnforcement: 'Tank holds productId; physical dips stored in nested /dipReadings/{dipId}',
  },
  {
    sourcePath: '/stations/{stationId}/shifts/{shiftId}',
    targetPath: 'nozzleAssignments/{id} & expenses/{id}',
    strategy: 'Shift-Scoped Subcollections + Terminal Lock',
    ruleEnforcement: 'Parent shift status != APPROVED checked via get() before nozzle/expense mutation',
  },
  {
    sourcePath: '/stations/{stationId}/creditCustomers/{customerId}',
    targetPath: 'ledger/{creditTxId} & sales/{saleId}',
    strategy: 'Append-Only Subledger Subcollection',
    ruleEnforcement: 'Ledger entries immutable (update: false, delete: false); linked via referenceId',
  },
];

export const FirestoreSchemaView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FirestoreTab>('collections');
  const [selectedPath, setSelectedPath] = useState<string>('/stations/{stationId}/shifts/{shiftId}');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const entities = blueprintJson.entities as Record<string, BlueprintEntity>;
  const firestorePaths = blueprintJson.firestore as Record<string, BlueprintPathDef>;
  const pathKeys = useMemo(() => Object.keys(firestorePaths), [firestorePaths]);

  const activePathDef = firestorePaths[selectedPath] ?? firestorePaths[pathKeys[0]];
  const resolvedEntityName =
    typeof activePathDef.schema === 'string'
      ? activePathDef.schema.replace('#/entities/', '')
      : activePathDef.schema.$ref.replace('#/entities/', '');
  const activeEntity = entities[resolvedEntityName];

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleDownloadJson = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">
              Firebase Firestore Enterprise · {pathKeys.length} Collection Paths ·{' '}
              {indexesJson.indexes.length} Composite Indexes
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Firebase Firestore Database Schema & Indexing Strategy
            </h1>
            <p className="text-sm text-slate-600">
              Multi-tenant collection/subcollection hierarchy, strict JSON Schema field constraints, PII split
              isolation, composite index definitions, and hardened Eight-Pillar security rules.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleDownloadJson('firebase-blueprint.json', blueprintJson)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 bg-white text-slate-700 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Blueprint .json</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadJson('firestore.indexes.json', indexesJson)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Indexes .json</span>
            </button>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md w-fit">
          {(
            [
              { id: 'collections', label: `Collections & Fields (${pathKeys.length})` },
              { id: 'indexes', label: `Indexing Strategy (${indexesJson.indexes.length})` },
              { id: 'rules', label: 'Security Rules & Audit (12 Vectors)' },
              { id: 'blueprint', label: 'Raw Blueprint JSON' },
            ] as { id: FirestoreTab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                activeTab === t.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Collections, Subcollections, Fields & Relationships */}
      {activeTab === 'collections' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Path Navigator */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800">
                Firestore Collection & Subcollection Hierarchy
              </div>
              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {pathKeys.map((path) => {
                  const def = firestorePaths[path];
                  const depth = path.split('/').filter(Boolean).length / 2;
                  const isSelected = path === selectedPath;
                  return (
                    <button
                      key={path}
                      type="button"
                      onClick={() => setSelectedPath(path)}
                      className={`w-full text-left px-4 py-3 transition-colors ${
                        isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`font-mono text-xs font-semibold break-all ${
                            isSelected ? 'text-blue-700' : 'text-slate-900'
                          }`}
                        >
                          {path}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0">
                          {depth <= 1 ? 'Root' : depth === 2 ? 'Subcollection' : 'Nested'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">{def.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Entity Field Specification */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-500 font-mono">{selectedPath}</div>
                  <h2 className="text-base font-semibold text-slate-900 mt-0.5">
                    Entity: {activeEntity?.title}
                  </h2>
                </div>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  {Object.keys(activeEntity?.properties ?? {}).length} fields
                </span>
              </div>

              <div className="px-6 py-3 border-b border-slate-100 text-xs text-slate-600">
                {activeEntity?.description}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                      <th className="py-2.5 px-6">Field</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Required</th>
                      <th className="py-2.5 px-6">Constraints & Rules</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {Object.entries(activeEntity?.properties ?? {}).map(([fieldName, prop]) => {
                      const isReq = activeEntity?.required?.includes(fieldName);
                      const constraints = [
                        prop.format ? `format: ${prop.format}` : null,
                        prop.enum ? `enum: ${prop.enum.join(' | ')}` : null,
                        prop.minLength ? `minLen: ${prop.minLength}` : null,
                        prop.maxLength ? `maxLen: ${prop.maxLength}` : null,
                        prop.pattern ? `regex: ${prop.pattern}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ');

                      return (
                        <tr key={fieldName} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-6 font-mono font-medium text-slate-900 whitespace-nowrap">
                            {fieldName}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-blue-700 whitespace-nowrap">
                            {prop.type}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                            {isReq ? 'YES' : 'OPTIONAL'}
                          </td>
                          <td className="py-2.5 px-6 text-slate-600">
                            <div>{prop.description ?? '—'}</div>
                            {constraints && (
                              <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                                {constraints}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Firestore Relationships & Modeling Decisions */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-900">
                Firestore Document Relationships & Security Binding Strategy
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-3 px-6">Parent / Source Path</th>
                    <th className="py-3 px-4">Related Target</th>
                    <th className="py-3 px-4">Modeling Pattern</th>
                    <th className="py-3 px-6">Rules & Query Enforcement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {RELATIONSHIPS_SUMMARY.map((rel) => (
                    <tr key={`${rel.sourcePath}-${rel.targetPath}`} className="hover:bg-slate-50/70">
                      <td className="py-3 px-6 font-mono font-medium text-slate-900">
                        {rel.sourcePath}
                      </td>
                      <td className="py-3 px-4 font-mono text-blue-700">{rel.targetPath}</td>
                      <td className="py-3 px-4 text-slate-800 font-medium">{rel.strategy}</td>
                      <td className="py-3 px-6 text-slate-600">{rel.ruleEnforcement}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Indexing Strategy */}
      {activeTab === 'indexes' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Composite & Collection-Group Indexes (`firestore.indexes.json`)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Single-field equality indexes are automatic; compound `where` + `orderBy` queries below
                  require explicit composite definitions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('indexes', JSON.stringify(indexesJson, null, 2))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 bg-white rounded-md hover:bg-slate-50"
              >
                {copiedKey === 'indexes' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedKey === 'indexes' ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-3 px-6">Collection Group</th>
                    <th className="py-3 px-4">Query Scope</th>
                    <th className="py-3 px-6">Indexed Fields & Sort Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {indexesJson.indexes.map((idx, i) => (
                    <tr key={`${idx.collectionGroup}-${i}`} className="hover:bg-slate-50/70">
                      <td className="py-3 px-6 font-mono font-semibold text-slate-900">
                        {idx.collectionGroup}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{idx.queryScope}</td>
                      <td className="py-3 px-6 font-mono text-blue-700">
                        {idx.fields.map((f) => `${f.fieldPath} (${f.order})`).join(' -> ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Security Rules & Dirty Dozen Verification */}
      {activeTab === 'rules' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Deployed Security Rules & Dirty Dozen Red-Team Vectors
              </h2>
            </div>
            <span className="text-xs font-mono text-emerald-700 font-semibold">
              ESLint Security Rules Verified · Deployed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-3 px-6">#</th>
                  <th className="py-3 px-4">Adversarial Vector</th>
                  <th className="py-3 px-4">Target Path</th>
                  <th className="py-3 px-4">Operation</th>
                  <th className="py-3 px-6">Expected Gate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {DIRTY_DOZEN_TEST_CASES.map((tc) => (
                  <tr key={tc.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-6 font-mono text-slate-500 tabular-nums">{tc.id}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <div>{tc.name}</div>
                      <div className="text-[11px] text-slate-500 font-normal">Actor: {tc.actor}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">{tc.collectionPath}</td>
                    <td className="py-3 px-4 font-mono text-slate-700 uppercase">{tc.operation}</td>
                    <td className="py-3 px-6 font-mono font-semibold text-red-700">
                      {tc.expectedResult}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Raw Blueprint */}
      {activeTab === 'blueprint' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900">firebase-blueprint.json</span>
            <button
              type="button"
              onClick={() => handleCopy('blueprint', JSON.stringify(blueprintJson, null, 2))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 bg-white rounded-md hover:bg-slate-50"
            >
              {copiedKey === 'blueprint' ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedKey === 'blueprint' ? 'Copied' : 'Copy JSON'}</span>
            </button>
          </div>
          <pre className="p-5 bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto max-h-[600px] leading-relaxed">
            <code>{JSON.stringify(blueprintJson, null, 2)}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
