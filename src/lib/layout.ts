import type { ResearchNode } from '../types';

const NODE_WIDTH = 240;
const NODE_VGAP = 28;
const LEVEL_HGAP = 130;
const ROW_HEIGHT = 86;

/**
 * 簡易橫向樹狀佈局（root 在左，子節點向右展開）。
 * 回傳 id -> {x, y}，會略過被收合節點的子樹。
 */
export function layoutTree(nodes: ResearchNode[]): Record<string, { x: number; y: number }> {
  const byId = new Map<string, ResearchNode>();
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) byId.set(n.id, n);
  for (const n of nodes) {
    if (n.parentId && byId.has(n.parentId)) {
      const arr = childrenOf.get(n.parentId) ?? [];
      arr.push(n.id);
      childrenOf.set(n.parentId, arr);
    }
  }

  const roots = nodes.filter((n) => n.parentId == null || !byId.has(n.parentId));
  const positions: Record<string, { x: number; y: number }> = {};
  let cursorY = 0;

  const place = (id: string, depth: number): { top: number; bottom: number } => {
    const node = byId.get(id)!;
    const children = node.collapsed ? [] : childrenOf.get(id) ?? [];
    const x = depth * (NODE_WIDTH + LEVEL_HGAP);

    if (children.length === 0) {
      const y = cursorY;
      cursorY += ROW_HEIGHT + NODE_VGAP;
      positions[id] = { x, y };
      return { top: y, bottom: y };
    }

    const childRanges = children.map((cid) => place(cid, depth + 1));
    const top = childRanges[0].top;
    const bottom = childRanges[childRanges.length - 1].bottom;
    const y = (top + bottom) / 2;
    positions[id] = { x, y };
    return { top: y, bottom: y };
  };

  for (const root of roots) {
    place(root.id, 0);
    cursorY += ROW_HEIGHT;
  }

  return positions;
}

export const LAYOUT_CONSTS = { NODE_WIDTH, ROW_HEIGHT };
