import { useCallback, useEffect, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react';
import { useTreeStore } from '../store/useTreeStore';
import { ResearchNodeView } from './nodes/ResearchNodeView';
import { MarqueeSelection } from './MarqueeSelection';
import { STATUS_STYLES } from '../lib/statusStyles';
import { isShiftClick, useShiftHeld } from '../hooks/useShiftHeld';
import type { ComputedNode } from '../types';

const nodeTypes = { research: ResearchNodeView };

function FitViewController() {
  const fitViewRequest = useTreeStore((s) => s.fitViewRequest);
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (fitViewRequest <= 0) return;
    const t = requestAnimationFrame(() => {
      void fitView({ padding: 0.12, duration: 220, maxZoom: 1.2 });
    });
    return () => cancelAnimationFrame(t);
  }, [fitViewRequest, fitView]);

  return null;
}

/** 計算被收合節點隱藏的後代集合 */
function hiddenSet(nodes: ComputedNode[]): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.parentId) {
      const arr = childrenOf.get(n.parentId) ?? [];
      arr.push(n.id);
      childrenOf.set(n.parentId, arr);
    }
  }
  const hidden = new Set<string>();
  const hideSubtree = (id: string) => {
    for (const cid of childrenOf.get(id) ?? []) {
      hidden.add(cid);
      hideSubtree(cid);
    }
  };
  for (const n of nodes) {
    if (n.collapsed && byId.has(n.id)) hideSubtree(n.id);
  }
  return hidden;
}

function blurSidebarField() {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.blur();
  }
}

export function Canvas() {
  const nodes = useTreeStore((s) => s.nodes);
  const selectedIds = useTreeStore((s) => s.selectedIds);
  const select = useTreeStore((s) => s.select);
  const setEditing = useTreeStore((s) => s.setEditing);
  const shiftHeldRef = useShiftHeld();

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const computed = useMemo(() => useTreeStore.getState().computed(), [nodes]);

  const childCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of computed) {
      if (n.parentId)
        counts.set(n.parentId, (counts.get(n.parentId) ?? 0) + 1);
    }
    return counts;
  }, [computed]);

  const hidden = useMemo(() => hiddenSet(computed), [computed]);

  const rfNodes: Node[] = useMemo(
    () =>
      computed
        .filter((n) => !hidden.has(n.id))
        .map((n) => ({
          id: n.id,
          type: 'research',
          position: n.position,
          data: { ...n, childCount: childCount.get(n.id) ?? 0 },
          selected: selectedSet.has(n.id),
          selectable: false,
        })),
    [computed, hidden, childCount, selectedSet]
  );

  const rfEdges: Edge[] = useMemo(
    () => {
      const byId = new Map(computed.map((n) => [n.id, n]));
      return computed
        .filter((n) => n.parentId && byId.has(n.parentId))
        .filter((n) => !hidden.has(n.id) && !hidden.has(n.parentId!))
        .map((n) => {
          const parent = byId.get(n.parentId!)!;
          const orphaned = n.derived === 'orphaned';
          const falsified = parent.status === 'falsified';
          return {
            id: `${n.parentId}-${n.id}`,
            source: n.parentId!,
            target: n.id,
            type: 'smoothstep',
            animated: parent.status === 'experimenting',
            selectable: false,
            focusable: false,
            interactionWidth: 0,
            className: orphaned
              ? 'edge-orphaned'
              : falsified
              ? 'edge-falsified'
              : '',
            style: {
              stroke: orphaned ? '#64748b' : STATUS_STYLES[parent.status].edgeStroke,
              strokeWidth: 2,
            },
          } satisfies Edge;
        });
    },
    [computed, hidden]
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      blurSidebarField();
      select(node.id, { shiftKey: isShiftClick(event, shiftHeldRef) });
    },
    [select, shiftHeldRef]
  );

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (event, node) => {
      if (isShiftClick(event, shiftHeldRef)) return;
      blurSidebarField();
      setEditing(node.id);
    },
    [setEditing, shiftHeldRef]
  );

  /** 按住 Shift 時點到空白或連線，不要清空既有複選 */
  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (isShiftClick(event, shiftHeldRef)) return;
      blurSidebarField();
      select(null);
    },
    [select, shiftHeldRef]
  );

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onNodeDoubleClick={onNodeDoubleClick}
      onPaneClick={onPaneClick}
      zoomOnDoubleClick={false}
      fitView
      fitViewOptions={{ padding: 0.12, maxZoom: 1.2 }}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      selectionOnDrag={false}
      selectionKeyCode={null}
      panOnDrag={[1, 2]}
      panActivationKeyCode="Space"
      defaultEdgeOptions={{ type: 'smoothstep', interactionWidth: 0 }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
      <Controls
        showInteractive={false}
        position="bottom-left"
        style={{ bottom: '7.5rem', left: 12 }}
      />
      <FitViewController />
      <MarqueeSelection />
    </ReactFlow>
  );
}
