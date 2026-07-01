import type { ComputedNode, ResearchNode } from '../types';
import { visibleComputedNodes } from './visibleNodes';

export type NavDirection = 'up' | 'down' | 'left' | 'right';

/**
 * 依橫向樹狀佈局語意選取鄰近節點：
 * 左＝父、右＝第一個可見子節點、上／下＝同層兄弟（文件順序）。
 */
export function neighborNodeId(
  direction: NavDirection,
  selectedId: string,
  computedNodes: ComputedNode[],
  nodes: ResearchNode[]
): string | null {
  const visible = visibleComputedNodes(computedNodes);
  const current = visible.find((n) => n.id === selectedId);
  if (!current) return null;

  const visibleIds = new Set(visible.map((n) => n.id));

  if (direction === 'left') {
    if (current.parentId && visibleIds.has(current.parentId)) return current.parentId;
    return null;
  }

  if (direction === 'right') {
    const child = nodes.find((n) => n.parentId === current.id && visibleIds.has(n.id));
    return child?.id ?? null;
  }

  const siblings = nodes.filter(
    (n) => n.parentId === current.parentId && visibleIds.has(n.id)
  );
  const idx = siblings.findIndex((n) => n.id === current.id);
  if (idx < 0) return null;

  if (direction === 'up' && idx > 0) return siblings[idx - 1].id;
  if (direction === 'down' && idx < siblings.length - 1) return siblings[idx + 1].id;
  return null;
}
