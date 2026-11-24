import React, { useMemo, useState } from 'react';
import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { DATABASE_TABLES, TABLE_RELATIONSHIPS } from '../data/schemaData';
import { DatabaseTable } from '../data/types';

const CARD_WIDTH = 260;
const CARD_HEADER_H = 38;
const ROW_H = 22;
const MAX_VISIBLE_COLS = 6;

function getCardHeight(table: DatabaseTable): number {
  const visibleCols = Math.min(table.columns.length, MAX_VISIBLE_COLS);
  const overflowRow = table.columns.length > MAX_VISIBLE_COLS ? 1 : 0;
  return CARD_HEADER_H + (visibleCols + overflowRow) * ROW_H + 10;
}

const DOMAIN_HEADER_STYLES: Record<DatabaseTable['domain'], string> = {
  'Core & Security': 'bg-slate-900 text-white',
  'Inventory & Supply': 'bg-amber-900 text-white',
  'Forecourt Operations': 'bg-blue-900 text-white',
  'Finance & Analytics': 'bg-teal-900 text-white',
};

export const ErdDiagramView: React.FC = () => {
  const [selectedTableId, setSelectedTableId] = useState<string>('shifts');
  const [domainFilter, setDomainFilter] = useState<string>('ALL');
  const [zoom, setZoom] = useState<number>(0.78);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 16, y: 16 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const tableMap = useMemo(() => {
    const map = new Map<string, DatabaseTable>();
    DATABASE_TABLES.forEach((t) => map.set(t.id, t));
    return map;
  }, []);

  const connectedEdges = useMemo(() => {
    return TABLE_RELATIONSHIPS.filter(
      (r) => r.fromTable === selectedTableId || r.toTable === selectedTableId
    );
  }, [selectedTableId]);

  const connectedTableIds = useMemo(() => {
    const set = new Set<string>([selectedTableId]);
    connectedEdges.forEach((r) => {
      set.add(r.fromTable);
      set.add(r.toTable);
    });
    return set;
  }, [selectedTableId, connectedEdges]);

  const selectedTable = tableMap.get(selectedTableId) ?? DATABASE_TABLES[0];

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button[data-entity-card="true"]')) return;
    setIsDragging(true);
    setDragOrigin({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragOrigin.x, y: e.clientY - dragOrigin.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetViewport = () => {
    setZoom(0.78);
    setPan({ x: 16, y: 16 });
  };

  return (
    <div className="space-y-4">
      {/* Header & Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">02. Entity Relationship Diagram (ERD)</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Click any entity to highlight its foreign key links and inspect referential constraints. Drag canvas to pan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            aria-label="Highlight domain"
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All 4 Domains (28 Entities)</option>
            <option value="Core & Security">Core & Security</option>
            <option value="Inventory & Supply">Inventory & Supply</option>
            <option value="Forecourt Operations">Forecourt Operations</option>
            <option value="Finance & Analytics">Finance & Analytics</option>
          </select>

          <div className="flex items-center gap-1 border border-slate-300 rounded-md bg-white p-0.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.45, +(z - 0.1).toFixed(2)))}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-xs font-mono text-slate-700 tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.2, +(z + 0.1).toFixed(2)))}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={resetViewport}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
              title="Reset view"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Canvas + Inspector Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        {/* Canvas */}
        <div className="xl:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-4">
              <span className="font-medium text-slate-800">Domains:</span>
              <span>Core & Security (Slate)</span>
              <span>·</span>
              <span>Inventory & Supply (Amber)</span>
              <span>·</span>
              <span>Forecourt Ops (Blue)</span>
              <span>·</span>
              <span>Finance (Teal)</span>
            </div>
            <div className="font-mono text-slate-500 tabular-nums">
              Active: {selectedTable.name} ({connectedEdges.length} links)
            </div>
          </div>

          <div
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`relative h-[680px] overflow-hidden canvas-grid select-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                width: 1300,
                height: 2240,
              }}
              className="relative"
            >
              {/* SVG Relationship Edges */}
              <svg
                width={1300}
                height={2240}
                className="absolute inset-0 pointer-events-none"
              >
                <defs>
                  <marker
                    id="arrow-active"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,1 L7,4 L0,7 Z" fill="#1d4ed8" />
                  </marker>
                  <marker
                    id="arrow-muted"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,1 L5,3 L0,5 Z" fill="#cbd5e1" />
                  </marker>
                </defs>

                {TABLE_RELATIONSHIPS.map((rel) => {
                  const fromT = tableMap.get(rel.fromTable);
                  const toT = tableMap.get(rel.toTable);
                  if (!fromT || !toT) return null;

                  const isHighlighted =
                    rel.fromTable === selectedTableId || rel.toTable === selectedTableId;

                  const fromX = fromT.erdPosition.x + CARD_WIDTH / 2;
                  const fromY = fromT.erdPosition.y + getCardHeight(fromT) / 2;
                  const toX = toT.erdPosition.x + CARD_WIDTH / 2;
                  const toY = toT.erdPosition.y + getCardHeight(toT) / 2;

                  const dx = toX - fromX;
                  const ctrlOffset = Math.min(Math.abs(dx) * 0.45, 140) || 70;
                  const pathD = `M ${fromX} ${fromY} C ${fromX + (dx >= 0 ? ctrlOffset : -ctrlOffset)} ${fromY}, ${
                    toX - (dx >= 0 ? ctrlOffset : -ctrlOffset)
                  } ${toY}, ${toX} ${toY}`;

                  const midX = (fromX + toX) / 2;
                  const midY = (fromY + toY) / 2;

                  return (
                    <g key={rel.id}>
                      <path
                        d={pathD}
                        fill="none"
                        stroke={isHighlighted ? '#1d4ed8' : '#cbd5e1'}
                        strokeWidth={isHighlighted ? 2.2 : 1}
                        strokeOpacity={isHighlighted ? 0.95 : 0.65}
                        markerEnd={isHighlighted ? 'url(#arrow-active)' : 'url(#arrow-muted)'}
                      />
                      {isHighlighted && (
                        <g transform={`translate(${midX}, ${midY})`}>
                          <rect
                            x={-28}
                            y={-10}
                            width={56}
                            height={20}
                            rx={4}
                            fill="#eff6ff"
                            stroke="#1d4ed8"
                            strokeWidth={1}
                          />
                          <text
                            x={0}
                            y={4}
                            textAnchor="middle"
                            fontSize={10}
                            fontFamily="JetBrains Mono, monospace"
                            fill="#1e40af"
                            fontWeight={600}
                          >
                            {rel.cardinality}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Entity Cards */}
              {DATABASE_TABLES.map((table) => {
                const isSelected = table.id === selectedTableId;
                const isConnected = connectedTableIds.has(table.id);
                const matchesDomain = domainFilter === 'ALL' || table.domain === domainFilter;
                const dimmed =
                  (!matchesDomain && !isSelected) ||
                  (domainFilter === 'ALL' && !isConnected);

                const visibleCols = table.columns.slice(0, MAX_VISIBLE_COLS);
                const hiddenCount = table.columns.length - visibleCols.length;

                return (
                  <button
                    key={table.id}
                    type="button"
                    data-entity-card="true"
                    onClick={() => setSelectedTableId(table.id)}
                    style={{
                      left: table.erdPosition.x,
                      top: table.erdPosition.y,
                      width: CARD_WIDTH,
                    }}
                    className={`absolute text-left bg-white rounded-md overflow-hidden border transition-all ${
                      isSelected
                        ? 'border-blue-700 ring-2 ring-blue-600/30 shadow-md z-20'
                        : isConnected
                        ? 'border-blue-400 shadow-sm z-10'
                        : 'border-slate-300 z-0'
                    } ${dimmed ? 'opacity-45 hover:opacity-95' : 'opacity-100'}`}
                  >
                    <div
                      className={`px-3 py-2 flex items-center justify-between text-xs font-mono font-semibold ${
                        DOMAIN_HEADER_STYLES[table.domain]
                      }`}
                    >
                      <span className="truncate">{table.name}</span>
                      <span className="text-[10px] opacity-80 tabular-nums">
                        {table.columns.length} cols
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100 px-3 py-1 bg-white">
                      {visibleCols.map((col) => (
                        <div
                          key={col.name}
                          className="flex items-center justify-between gap-2 py-0.5 text-[11px] font-mono"
                        >
                          <span className="truncate text-slate-800">
                            {col.key ? (
                              <span className="text-blue-700 font-semibold mr-1">{col.key}</span>
                            ) : null}
                            {col.name}
                          </span>
                          <span className="text-slate-400 shrink-0 text-[10px]">{col.dataType}</span>
                        </div>
                      ))}
                      {hiddenCount > 0 && (
                        <div className="py-0.5 text-[10px] font-mono text-slate-400">
                          + {hiddenCount} more attributes
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Entity Inspector */}
        <div className="xl:col-span-4 bg-white border border-slate-200 rounded-lg flex flex-col max-h-[726px]">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">Selected Entity · {selectedTable.domain}</div>
              <h2 className="font-mono text-base font-semibold text-slate-900 mt-0.5">
                {selectedTable.name}
              </h2>
            </div>
            <Maximize2 className="w-4 h-4 text-slate-400" />
          </div>

          <div className="p-5 overflow-y-auto space-y-5 flex-1">
            <p className="text-xs text-slate-600 leading-relaxed">{selectedTable.description}</p>

            {/* Columns */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-900">
                Attributes ({selectedTable.columns.length})
              </div>
              <div className="border border-slate-200 rounded-md divide-y divide-slate-100">
                {selectedTable.columns.map((col) => (
                  <div key={col.name} className="px-3 py-2 text-xs space-y-0.5">
                    <div className="flex items-center justify-between gap-2 font-mono">
                      <span className="font-medium text-slate-900">
                        {col.key ? <span className="text-blue-700 mr-1.5">[{col.key}]</span> : null}
                        {col.name}
                      </span>
                      <span className="text-slate-500">{col.dataType}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">{col.description}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Foreign Key Relationships */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-900">
                Referential Relationships ({connectedEdges.length})
              </div>
              <div className="border border-slate-200 rounded-md divide-y divide-slate-100">
                {connectedEdges.map((rel) => {
                  const isOutbound = rel.fromTable === selectedTableId;
                  const targetName = isOutbound ? rel.toTable : rel.fromTable;
                  return (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => setSelectedTableId(targetName)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-blue-700 font-medium">
                          {isOutbound ? `-> ${rel.toTable}` : `<- ${rel.fromTable}`}
                        </span>
                        <span className="text-slate-500">
                          {rel.cardinality} · ON DELETE {rel.onDelete}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                        {rel.fromTable}.{rel.fromColumn} references {rel.toTable}.{rel.toColumn}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
