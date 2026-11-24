import React, { useMemo, useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { SYSTEM_MODULES } from '../data/rbacData';
import { WORKFLOW_DIAGRAMS } from '../data/workflowData';
import { WorkflowNode } from '../data/types';

const NODE_WIDTH = 232;
const NODE_HEIGHT = 112;

const ACTOR_STYLES: Record<WorkflowNode['actor'], { label: string; headerBg: string }> = {
  OWNER: { label: 'Owner', headerBg: 'bg-slate-900 text-white' },
  MANAGER: { label: 'Manager', headerBg: 'bg-blue-800 text-white' },
  OPERATOR: { label: 'Operator', headerBg: 'bg-teal-800 text-white' },
  SYSTEM: { label: 'System Engine', headerBg: 'bg-amber-800 text-white' },
};

export const WorkflowDiagramsView: React.FC = () => {
  const [activeWorkflowId, setActiveWorkflowId] = useState<string>(WORKFLOW_DIAGRAMS[0].id);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(WORKFLOW_DIAGRAMS[0].nodes[0].id);

  const workflow = useMemo(
    () => WORKFLOW_DIAGRAMS.find((w) => w.id === activeWorkflowId) ?? WORKFLOW_DIAGRAMS[0],
    [activeWorkflowId]
  );

  const nodeMap = useMemo(() => {
    const map = new Map<string, WorkflowNode>();
    workflow.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [workflow]);

  const activeNode = nodeMap.get(selectedNodeId) ?? workflow.nodes[0];

  const handleSelectWorkflow = (id: string) => {
    setActiveWorkflowId(id);
    const nextWf = WORKFLOW_DIAGRAMS.find((w) => w.id === id);
    if (nextWf && nextWf.nodes.length > 0) {
      setSelectedNodeId(nextWf.nodes[0].id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Workflow Switcher */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">05. Operational Workflow Diagrams</h1>
          <p className="text-sm text-slate-600">
            Interactive state-transition blueprints tracing actor handoffs, database mutations, and automated double-entry
            and notification guards across the station lifecycle.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 pt-2">
          {WORKFLOW_DIAGRAMS.map((wf) => {
            const isActive = wf.id === workflow.id;
            return (
              <button
                key={wf.id}
                type="button"
                onClick={() => handleSelectWorkflow(wf.id)}
                className={`text-left p-3.5 rounded-md border transition-colors ${
                  isActive
                    ? 'border-blue-700 bg-blue-50/60 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-semibold leading-snug">{wf.title}</div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">
                  {wf.nodes.length} steps · {wf.edges.length} transitions
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Workflow Meta Strip */}
      <div className="bg-white border border-slate-200 rounded-lg px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="space-y-0.5">
          <div className="font-semibold text-slate-900 text-sm">{workflow.title}</div>
          <div className="text-slate-600">{workflow.subtitle}</div>
        </div>
        <div className="text-right space-y-0.5">
          <div className="text-slate-500">
            Trigger: <span className="font-medium text-slate-800">{workflow.trigger}</span>
          </div>
          <div className="font-mono text-[11px] text-blue-700">{workflow.slaOrInvariant}</div>
        </div>
      </div>

      {/* Interactive Node-Edge Diagram Canvas */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-4">
            <span className="font-medium text-slate-800">Actors:</span>
            <span>Owner (Slate)</span>
            <span>·</span>
            <span>Manager (Blue)</span>
            <span>·</span>
            <span>Operator (Teal)</span>
            <span>·</span>
            <span>System Engine (Amber)</span>
          </div>
          <span className="text-slate-500">Click any step node to inspect guard rules & SQL mutations</span>
        </div>

        <div className="overflow-x-auto canvas-grid p-4">
          <div className="relative mx-auto" style={{ width: 1180, height: 430 }}>
            {/* SVG Edges */}
            <svg width={1180} height={430} className="absolute inset-0 pointer-events-none">
              <defs>
                <marker id="wf-arrow-normal" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,1 L7,4 L0,7 Z" fill="#1d4ed8" />
                </marker>
                <marker id="wf-arrow-alert" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,1 L7,4 L0,7 Z" fill="#dc2626" />
                </marker>
                <marker id="wf-arrow-branch" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,1 L7,4 L0,7 Z" fill="#d97706" />
                </marker>
              </defs>

              {workflow.edges.map((edge) => {
                const fromN = nodeMap.get(edge.from);
                const toN = nodeMap.get(edge.to);
                if (!fromN || !toN) return null;

                const fromCx = fromN.x + NODE_WIDTH / 2;
                const fromCy = fromN.y + NODE_HEIGHT / 2;
                const toCx = toN.x + NODE_WIDTH / 2;
                const toCy = toN.y + NODE_HEIGHT / 2;

                // Determine anchor points cleanly based on relative positions
                let startX = fromN.x + NODE_WIDTH;
                let startY = fromCy;
                let endX = toN.x;
                let endY = toCy;

                if (Math.abs(fromN.x - toN.x) < 40 && toN.y > fromN.y) {
                  // Vertical down
                  startX = fromCx;
                  startY = fromN.y + NODE_HEIGHT;
                  endX = toCx;
                  endY = toN.y;
                } else if (toN.x < fromN.x) {
                  // Backward / lower horizontal link
                  startX = fromN.x;
                  startY = fromCy;
                  endX = toN.x + NODE_WIDTH;
                  endY = toCy;
                } else if (toN.y > fromN.y + 80) {
                  // Diagonal down-right
                  startX = fromCx;
                  startY = fromN.y + NODE_HEIGHT;
                  endX = toN.x;
                  endY = toCy;
                } else if (fromN.y > toN.y + 80) {
                  // Diagonal up-right
                  startX = fromN.x + NODE_WIDTH;
                  startY = fromCy;
                  endX = toCx;
                  endY = toN.y + NODE_HEIGHT;
                }

                const midX = (startX + endX) / 2;
                const midY = (startY + endY) / 2;
                const ctrlX1 = startX + (endX - startX) * 0.45;
                const ctrlX2 = endX - (endX - startX) * 0.45;
                const pathD =
                  Math.abs(startX - endX) < 10
                    ? `M ${startX} ${startY} L ${endX} ${endY}`
                    : `M ${startX} ${startY} C ${ctrlX1} ${startY}, ${ctrlX2} ${endY}, ${endX} ${endY}`;

                const strokeColor =
                  edge.variant === 'alert'
                    ? '#dc2626'
                    : edge.variant === 'branch'
                    ? '#d97706'
                    : '#1d4ed8';
                const markerId =
                  edge.variant === 'alert'
                    ? 'url(#wf-arrow-alert)'
                    : edge.variant === 'branch'
                    ? 'url(#wf-arrow-branch)'
                    : 'url(#wf-arrow-normal)';

                return (
                  <g key={edge.id}>
                    <path
                      d={pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={2}
                      strokeDasharray={edge.variant === 'alert' ? '5 4' : undefined}
                      markerEnd={markerId}
                    />
                    {edge.label && (
                      <g transform={`translate(${midX}, ${midY})`}>
                        <rect
                          x={-58}
                          y={-11}
                          width={116}
                          height={22}
                          rx={4}
                          fill="#ffffff"
                          stroke={strokeColor}
                          strokeWidth={1}
                        />
                        <text
                          x={0}
                          y={4}
                          textAnchor="middle"
                          fontSize={10}
                          fontFamily="JetBrains Mono, monospace"
                          fill={strokeColor}
                          fontWeight={600}
                        >
                          {edge.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Step Nodes */}
            {workflow.nodes.map((node) => {
              const isSelected = node.id === activeNode.id;
              const actorStyle = ACTOR_STYLES[node.actor];
              const modName =
                SYSTEM_MODULES.find((m) => m.id === node.moduleId)?.name ?? node.moduleId;

              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedNodeId(node.id)}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: NODE_WIDTH,
                    height: NODE_HEIGHT,
                  }}
                  className={`absolute text-left bg-white rounded-md border overflow-hidden transition-all flex flex-col ${
                    isSelected
                      ? 'border-blue-700 ring-2 ring-blue-600/30 shadow-md z-20'
                      : 'border-slate-300 hover:border-slate-400 shadow-sm z-10'
                  }`}
                >
                  <div
                    className={`px-3 py-1.5 flex items-center justify-between text-[11px] font-medium ${actorStyle.headerBg}`}
                  >
                    <span>
                      {node.stepNumber}. {actorStyle.label}
                    </span>
                    <span className="font-mono text-[10px] opacity-85 uppercase">
                      {node.nodeType}
                    </span>
                  </div>
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2">
                      {node.title}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {modName} · {node.tablesTouched.length} tables
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Step Specification Inspector */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-2">
          <div className="text-xs font-mono text-slate-500">
            Step {activeNode.stepNumber} · Actor: {ACTOR_STYLES[activeNode.actor].label}
          </div>
          <h2 className="text-lg font-semibold text-slate-900">{activeNode.title}</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{activeNode.description}</p>
        </div>

        <div className="lg:col-span-4 space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <ShieldCheck className="w-4 h-4 text-blue-700" />
            <span>Authorization & Integrity Guard</span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-md p-3">
            {activeNode.guardRule}
          </p>
        </div>

        <div className="lg:col-span-3 space-y-2">
          <div className="text-xs font-semibold text-slate-900">Database Tables Mutated / Read</div>
          <div className="border border-slate-200 rounded-md divide-y divide-slate-100">
            {activeNode.tablesTouched.map((tbl) => (
              <div
                key={tbl}
                className="px-3 py-1.5 font-mono text-xs text-slate-800 flex items-center justify-between"
              >
                <span>{tbl}</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
