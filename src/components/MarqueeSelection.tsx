import { useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useTreeStore } from '../store/useTreeStore';
import { computeDerivedStatus } from '../lib/inference';
import { LAYOUT_CONSTS } from '../lib/layout';
import { isShiftClick, useShiftHeld } from '../hooks/useShiftHeld';
import type { ComputedNode } from '../types';

const DRAG_THRESHOLD = 4;
const NODE_W = LAYOUT_CONSTS.NODE_WIDTH;
const NODE_H = LAYOUT_CONSTS.ROW_HEIGHT;

type Rect = { x: number; y: number; w: number; h: number };

function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** 與 Canvas 相同：收合節點的子樹不顯示 */
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

/** 在空白處拖曳框選節點（不依賴 React Flow 內建 selection，避免受控選取無限迴圈） */
export function MarqueeSelection() {
  const storeNodes = useTreeStore((s) => s.nodes);
  const selectedIds = useTreeStore((s) => s.selectedIds);
  const selectMany = useTreeStore((s) => s.selectMany);
  const { screenToFlowPosition } = useReactFlow();
  const shiftHeldRef = useShiftHeld();

  const [screenRect, setScreenRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const spaceHeldRef = useRef(false);
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  const nodeBounds = useMemo(() => {
    const computed = computeDerivedStatus(storeNodes);
    const hidden = hiddenSet(computed);
    return computed
      .filter((n) => !hidden.has(n.id))
      .map((n) => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        w: NODE_W,
        h: NODE_H,
      }));
  }, [storeNodes]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeldRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeldRef.current = false;
    };
    const onBlur = () => {
      spaceHeldRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    const getPane = () =>
      document.querySelector('.react-flow__pane') as HTMLElement | null;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (spaceHeldRef.current) return;
      const pane = getPane();
      if (!pane || e.target !== pane) return;

      dragRef.current = { startX: e.clientX, startY: e.clientY, moved: false };
    };

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dx = Math.abs(e.clientX - drag.startX);
      const dy = Math.abs(e.clientY - drag.startY);
      if (!drag.moved && dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) return;

      drag.moved = true;
      const left = Math.min(drag.startX, e.clientX);
      const top = Math.min(drag.startY, e.clientY);
      setScreenRect({
        left,
        top,
        width: Math.abs(e.clientX - drag.startX),
        height: Math.abs(e.clientY - drag.startY),
      });
    };

    const onPointerUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      setScreenRect(null);
      if (!drag?.moved) return;

      const flowStart = screenToFlowPosition({ x: drag.startX, y: drag.startY });
      const flowEnd = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const sel: Rect = {
        x: Math.min(flowStart.x, flowEnd.x),
        y: Math.min(flowStart.y, flowEnd.y),
        w: Math.abs(flowEnd.x - flowStart.x),
        h: Math.abs(flowEnd.y - flowStart.y),
      };

      const hitIds = nodeBounds.filter((n) => rectsIntersect(sel, n)).map((n) => n.id);

      blurSidebarField();
      if (isShiftClick(e, shiftHeldRef)) {
        const merged = new Set([...selectedIdsRef.current, ...hitIds]);
        selectMany([...merged]);
      } else {
        selectMany(hitIds);
      }
    };

    const attach = () => {
      const pane = getPane();
      if (!pane) return false;
      pane.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      return true;
    };

    let attached = attach();
    const retry = attached ? undefined : requestAnimationFrame(() => attach());

    return () => {
      if (retry) cancelAnimationFrame(retry);
      const pane = getPane();
      if (pane) pane.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [nodeBounds, screenToFlowPosition, selectMany, shiftHeldRef]);

  if (!screenRect) return null;

  return (
    <div
      className="pointer-events-none fixed z-10 border border-sky-400/60 bg-sky-400/10"
      style={{
        left: screenRect.left,
        top: screenRect.top,
        width: screenRect.width,
        height: screenRect.height,
      }}
    />
  );
}
