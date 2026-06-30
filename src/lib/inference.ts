import type { ComputedNode, ResearchNode } from '../types';

/**
 * 推論崩塌計算：
 * 從每個節點往上追溯祖先，若其推論鏈上存在任一被「推翻 (falsified)」的祖先，
 * 則該節點失去支撐，標記為 orphaned（懸空）。被推翻的節點本身不算 orphaned，
 * 但其所有下游子孫都會被標記為懸空。
 */
export function computeDerivedStatus(nodes: ResearchNode[]): ComputedNode[] {
  const byId = new Map<string, ResearchNode>();
  for (const n of nodes) byId.set(n.id, n);

  const cache = new Map<string, { derived: 'supported' | 'orphaned'; collapsedBy?: string }>();

  const resolve = (
    node: ResearchNode,
    visiting: Set<string>
  ): { derived: 'supported' | 'orphaned'; collapsedBy?: string } => {
    const cached = cache.get(node.id);
    if (cached) return cached;

    let result: { derived: 'supported' | 'orphaned'; collapsedBy?: string };

    if (node.parentId == null || visiting.has(node.id)) {
      result = { derived: 'supported' };
    } else {
      const parent = byId.get(node.parentId);
      if (!parent) {
        result = { derived: 'supported' };
      } else if (parent.status === 'falsified') {
        result = { derived: 'orphaned', collapsedBy: parent.id };
      } else {
        visiting.add(node.id);
        const parentResult = resolve(parent, visiting);
        visiting.delete(node.id);
        result =
          parentResult.derived === 'orphaned'
            ? { derived: 'orphaned', collapsedBy: parentResult.collapsedBy }
            : { derived: 'supported' };
      }
    }

    cache.set(node.id, result);
    return result;
  };

  return nodes.map((n) => {
    const { derived, collapsedBy } = resolve(n, new Set());
    return { ...n, derived, collapsedBy };
  });
}

/** 取得某節點的所有子孫 id（含深層） */
export function getDescendantIds(nodes: ResearchNode[], rootId: string): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.parentId) {
      const arr = childrenOf.get(n.parentId) ?? [];
      arr.push(n.id);
      childrenOf.set(n.parentId, arr);
    }
  }
  const out: string[] = [];
  const stack = [...(childrenOf.get(rootId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    stack.push(...(childrenOf.get(id) ?? []));
  }
  return out;
}
