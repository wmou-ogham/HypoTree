import { useEffect, useRef } from 'react';
import { useReactFlow, type Node } from '@xyflow/react';
import { useTreeStore } from '../store/useTreeStore';
import { LAYOUT_CONSTS } from '../lib/layout';
import { isShiftClick, useShiftHeld } from '../hooks/useShiftHeld';

const DRAG_THRESHOLD = 4;
const NODE_W = LAYOUT_CONSTS.NODE_WIDTH;
const NODE_H = LAYOUT_CONSTS.ROW_HEIGHT;

type Rect = { x: number; y: number; w: number; h: number };

function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function nodeRect(n: Node): Rect {
  const w = n.measured?.width ?? NODE_W;
  const h = n.measured?.height ?? NODE_H;
  return { x: n.position.x, y: n.position.y, w, h };
}

function blurSidebarField() {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.blur();
  }
}

/** 框選結束後略過一次 pane click，避免 onPaneClick 清空選取 */
export const skipNextPaneClickRef = { current: false };

/** 在空白處拖曳框選節點（不依賴 React Flow 內建 selection，避免受控選取無限迴圈） */
export function MarqueeSelection() {
  const selectMany = useTreeStore((s) => s.selectMany);
  const { screenToFlowPosition, getNodes } = useReactFlow();
  const shiftHeldRef = useShiftHeld();

  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const spaceHeldRef = useRef(false);
  const selectedIdsRef = useRef(useTreeStore.getState().selectedIds);
  const rfApiRef = useRef({ screenToFlowPosition, getNodes });

  selectedIdsRef.current = useTreeStore.getState().selectedIds;
  rfApiRef.current = { screenToFlowPosition, getNodes };

  useEffect(() => {
    return useTreeStore.subscribe((s) => {
      selectedIdsRef.current = s.selectedIds;
    });
  }, []);

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

    const updateOverlay = (left: number, top: number, width: number, height: number) => {
      const el = overlayRef.current;
      if (!el) return;
      if (width <= 0 && height <= 0) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
    };

    const hideOverlay = () => updateOverlay(0, 0, 0, 0);

    const isMarqueeStart = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      if (target.closest('.react-flow__node')) return false;
      const pane = getPane();
      return pane !== null && pane.contains(target);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (spaceHeldRef.current) return;
      if (!isMarqueeStart(e.target)) return;

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
      updateOverlay(left, top, Math.abs(e.clientX - drag.startX), Math.abs(e.clientY - drag.startY));
    };

    const onPointerUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      hideOverlay();
      if (!drag?.moved) return;

      skipNextPaneClickRef.current = true;

      const { screenToFlowPosition: toFlow, getNodes: nodes } = rfApiRef.current;
      const flowStart = toFlow({ x: drag.startX, y: drag.startY });
      const flowEnd = toFlow({ x: e.clientX, y: e.clientY });
      const sel: Rect = {
        x: Math.min(flowStart.x, flowEnd.x),
        y: Math.min(flowStart.y, flowEnd.y),
        w: Math.abs(flowEnd.x - flowStart.x),
        h: Math.abs(flowEnd.y - flowStart.y),
      };

      const hitIds = nodes()
        .filter((n) => rectsIntersect(sel, nodeRect(n)))
        .map((n) => n.id);

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
  }, [selectMany, shiftHeldRef]);

  return (
    <div
      ref={overlayRef}
      className="pointer-events-none fixed z-10 hidden border border-sky-400/60 bg-sky-400/10"
    />
  );
}
