import type { ResearchNode } from '../types';
import type { NavDirection } from './nodeNavigation';

function buildChildrenOf(nodes: ResearchNode[]): Map<string | null, string[]> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string | null, string[]>();

  for (const n of nodes) {
    const key = n.parentId && byId.has(n.parentId) ? n.parentId : null;
    const arr = childrenOf.get(key) ?? [];
    arr.push(n.id);
    childrenOf.set(key, arr);
  }
  return childrenOf;
}

function flattenTree(
  nodes: ResearchNode[],
  childrenOf: Map<string | null, string[]>
): ResearchNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: ResearchNode[] = [];
  const walk = (id: string) => {
    const n = byId.get(id);
    if (!n) return;
    out.push(n);
    for (const cid of childrenOf.get(id) ?? []) walk(cid);
  };
  for (const rid of childrenOf.get(null) ?? []) walk(rid);
  return out;
}

function siblingKey(node: ResearchNode, byId: Map<string, ResearchNode>): string | null {
  return node.parentId && byId.has(node.parentId) ? node.parentId : null;
}

/**
 * 調整節點在樹中的順序與層級（對應 Markdown 縮排與同層順序）：
 * 上／下＝同層兄弟排序，左＝升一層，右＝降一層（成為前一個兄弟的子節點）。
 */
export function moveNodeInTree(
  nodes: ResearchNode[],
  nodeId: string,
  direction: NavDirection
): ResearchNode[] | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const node = byId.get(nodeId);
  if (!node) return null;

  const childrenOf = buildChildrenOf(nodes);
  const key = siblingKey(node, byId);
  const siblings = [...(childrenOf.get(key) ?? [])];
  const idx = siblings.indexOf(nodeId);
  if (idx < 0) return null;

  if (direction === 'up') {
    if (idx === 0) return null;
    [siblings[idx - 1], siblings[idx]] = [siblings[idx], siblings[idx - 1]];
    childrenOf.set(key, siblings);
    return flattenTree(nodes, childrenOf);
  }

  if (direction === 'down') {
    if (idx >= siblings.length - 1) return null;
    [siblings[idx], siblings[idx + 1]] = [siblings[idx + 1], siblings[idx]];
    childrenOf.set(key, siblings);
    return flattenTree(nodes, childrenOf);
  }

  if (direction === 'left') {
    if (!node.parentId || !byId.has(node.parentId)) return null;
    const parent = byId.get(node.parentId)!;
    const gpKey = siblingKey(parent, byId);

    const parentChildren = (childrenOf.get(parent.id) ?? []).filter((id) => id !== nodeId);
    childrenOf.set(parent.id, parentChildren);

    node.parentId =
      parent.parentId && byId.has(parent.parentId) ? parent.parentId : null;

    const gpSiblings = [...(childrenOf.get(gpKey) ?? [])];
    const parentIdx = gpSiblings.indexOf(parent.id);
    if (parentIdx < 0) return null;
    gpSiblings.splice(parentIdx + 1, 0, nodeId);
    childrenOf.set(gpKey, gpSiblings);

    return flattenTree([...nodes], childrenOf);
  }

  if (direction === 'right') {
    if (idx === 0) return null;
    const prevId = siblings[idx - 1];

    siblings.splice(idx, 1);
    childrenOf.set(key, siblings);

    node.parentId = prevId;
    const prevChildren = [...(childrenOf.get(prevId) ?? []), nodeId];
    childrenOf.set(prevId, prevChildren);

    return flattenTree([...nodes], childrenOf);
  }

  return null;
}
