import { useCallback, useEffect, useMemo } from 'react';
import { toPng } from 'html-to-image';
import { useIsMobile } from '../hooks/useIsMobile';
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
import { MarqueeSelection, skipNextPaneClickRef } from './MarqueeSelection';
import { STATUS_STYLES } from '../lib/statusStyles';
import { isShiftClick, useShiftHeld } from '../hooks/useShiftHeld';
import { hiddenNodeIds } from '../lib/visibleNodes';

const nodeTypes = { research: ResearchNodeView };

/** Toolbar 透過此 ref 觸發 PNG 匯出（需在 ReactFlowProvider 內才能 fitView） */
export const pngExportTrigger: { current: (() => Promise<void>) | null } = { current: null };

const PNG_BG = '#0b1120';

/**
 * 根據 fitView 後的縮放比動態決定 pixelRatio：
 * - zoom 越小（圖越大）→ pixelRatio 越高，確保節點文字清晰
 * - 最低 2x（普通視圖），最高 6x（非常小的縮放），避免檔案過大
 */
function calcPixelRatio(zoom: number): number {
  // 目標：最終輸出圖像的每個「畫面像素」對應 2 個「畫布像素」(baseline)
  // 如果 zoom=0.5，節點在螢幕上縮小一半，需要加倍採樣才有同等清晰度
  const ideal = Math.ceil(2 / Math.max(zoom, 0.1));
  return Math.min(6, Math.max(2, ideal));
}

function PngExportController() {
  const { fitView, getViewport } = useReactFlow();
  const docName = useTreeStore((s) => s.docName);

  useEffect(() => {
    pngExportTrigger.current = async () => {
      // 1. fit view 並稍等動畫結束
      fitView({ padding: 0.13, maxZoom: 1.2, duration: 320 });
      await new Promise((r) => setTimeout(r, 420));

      // 2. 根據目前縮放比計算輸出解析度
      const { zoom } = getViewport();
      const pixelRatio = calcPixelRatio(zoom);

      // 3. 截圖：只取 ReactFlow 畫布，排除縮放控制
      const el = document.querySelector('.react-flow') as HTMLElement | null;
      if (!el) return;

      const dataUrl = await toPng(el, {
        backgroundColor: PNG_BG,
        pixelRatio,
        filter: (node) => {
          if (node instanceof HTMLElement) {
            if (node.classList.contains('react-flow__controls')) return false;
            if (node.classList.contains('react-flow__panel')) return false;
          }
          return true;
        },
      });

      // 4. 在右下角壓水印（大小固定為「視覺上 14px」，不隨 pixelRatio 等比放大）
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((r) => { img.onload = () => r(); });

      const cvs = document.createElement('canvas');
      cvs.width = img.width;
      cvs.height = img.height;
      const ctx = cvs.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const s = pixelRatio;
      const pad = 18 * s;
      const fontSize = 14 * s;
      ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4 * s;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText('🌲 hypotree', cvs.width - pad, cvs.height - pad);

      // 5. 下載
      const a = document.createElement('a');
      a.href = cvs.toDataURL('image/png');
      a.download = `${docName || 'hypotree'}.png`;
      a.click();
    };

    return () => { pngExportTrigger.current = null; };
  }, [fitView, getViewport, docName]);

  return null;
}

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

function blurSidebarField() {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.blur();
  }
}

export function Canvas() {
  const computedNodes = useTreeStore((s) => s.computedNodes);
  const selectedIds = useTreeStore((s) => s.selectedIds);
  const select = useTreeStore((s) => s.select);
  const setEditing = useTreeStore((s) => s.setEditing);
  const shiftHeldRef = useShiftHeld();
  const isMobile = useIsMobile();

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const childCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of computedNodes) {
      if (n.parentId)
        counts.set(n.parentId, (counts.get(n.parentId) ?? 0) + 1);
    }
    return counts;
  }, [computedNodes]);

  const hidden = useMemo(() => hiddenNodeIds(computedNodes), [computedNodes]);

  const rfNodes: Node[] = useMemo(
    () =>
      computedNodes
        .filter((n) => !hidden.has(n.id))
        .map((n) => ({
          id: n.id,
          type: 'research',
          position: n.position,
          data: { ...n, childCount: childCount.get(n.id) ?? 0 },
          selected: selectedSet.has(n.id),
          selectable: false,
        })),
    [computedNodes, hidden, childCount, selectedSet]
  );

  const rfEdges: Edge[] = useMemo(
    () => {
      const byId = new Map(computedNodes.map((n) => [n.id, n]));
      return computedNodes
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
    [computedNodes, hidden]
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
      if (skipNextPaneClickRef.current) {
        skipNextPaneClickRef.current = false;
        return;
      }
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
      defaultEdgeOptions={{ type: 'smoothstep', interactionWidth: 0 }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
      <Controls
        showInteractive={false}
        position="bottom-left"
        style={{ bottom: isMobile ? '1rem' : '7.5rem', left: 12 }}
      />
      <FitViewController />
      <MarqueeSelection />
      <PngExportController />
    </ReactFlow>
  );
}
