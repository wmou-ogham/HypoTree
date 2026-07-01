import type { ComputedNode } from '../types';

/** 計算被收合節點隱藏的後代集合 */
export function hiddenNodeIds(nodes: ComputedNode[]): Set<string> {
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

export function visibleComputedNodes(nodes: ComputedNode[]): ComputedNode[] {
  const hidden = hiddenNodeIds(nodes);
  return nodes.filter((n) => !hidden.has(n.id));
}
