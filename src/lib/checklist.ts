import type { CheckItem, ResearchNode } from '../types';

export const CHECKLIST_UNCHECKED = '☐';
export const CHECKLIST_CHECKED = '☑';

/** 依驗證步驟完成比例計算實驗進度（0–100） */
export function progressFromCheckItems(items: CheckItem[] | undefined): number {
  if (!items?.length) return 0;
  const done = items.filter((i) => i.done).length;
  return Math.round((done / items.length) * 100);
}

export function withSyncedProgress(node: ResearchNode): ResearchNode {
  const items = node.checkItems;
  if (!items?.length) return { ...node, progress: 0 };
  return { ...node, progress: progressFromCheckItems(items) };
}
