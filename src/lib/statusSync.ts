import type { ResearchNode } from '../types';

/** 有證據/文獻時自動標記為實驗中；無證據且仍為實驗中則回到假設中 */
export function syncStatusWithEvidence(node: ResearchNode): ResearchNode {
  if (node.evidence.length > 0) {
    if (node.status === 'hypothesis') {
      return { ...node, status: 'experimenting' };
    }
    return node;
  }
  if (node.status === 'experimenting') {
    return { ...node, status: 'hypothesis' };
  }
  return node;
}

export function syncAllNodesEvidenceStatus(nodes: ResearchNode[]): ResearchNode[] {
  return nodes.map(syncStatusWithEvidence);
}
