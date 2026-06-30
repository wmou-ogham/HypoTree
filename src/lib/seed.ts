import type { ResearchNode } from '../types';

const uid = () => crypto.randomUUID();

/** 空白新研究：僅含一個根節點 */
export function createEmptyResearch(name: string): ResearchNode[] {
  return [
    {
      id: uid(),
      title: name,
      status: 'hypothesis',
      progress: 0,
      evidence: [],
      parentId: null,
      position: { x: 0, y: 0 },
    },
  ];
}

/** 一棵示範研究樹：以「降低系統延遲」為主題 */
export function createSeedNodes(): ResearchNode[] {
  const root = uid();
  const cache = uid();
  const redis = uid();
  const index = uid();
  const algo = uid();
  const pool = uid();

  const nodes: ResearchNode[] = [
    {
      id: root,
      title: '如何降低 API 平均延遲 50%？',
      status: 'hypothesis',
      progress: 30,
      evidence: [],
      note: '研究主問題',
      parentId: null,
      position: { x: 0, y: 0 },
    },
    {
      id: cache,
      title: '增加快取層可降低 50% 延遲',
      status: 'validated',
      progress: 100,
      evidence: [
        {
          id: uid(),
          type: 'citation',
          label: '快取效益文獻',
          date: '2026-06-15',
          annotation: '論文指出多層快取可顯著降低讀取延遲',
          value: 'https://doi.org/10.1145/3289602',
        },
        {
          id: uid(),
          type: 'dataset',
          label: '命中率量測',
          date: '2026-06-30',
          value: '{ "hitRate": 0.9, "p99_before_ms": 320, "p99_after_ms": 140 }',
        },
      ],
      parentId: root,
      position: { x: 0, y: 0 },
    },
    {
      id: redis,
      title: '使用 Redis 作為快取後端',
      status: 'validated',
      progress: 90,
      evidence: [],
      parentId: cache,
      position: { x: 0, y: 0 },
    },
    {
      id: index,
      title: '加索引可大幅改善查詢延遲',
      status: 'falsified',
      progress: 100,
      evidence: [
        {
          id: uid(),
          type: 'code',
          label: '失敗的 EXPLAIN',
          annotation: '查詢計畫仍走全表掃描',
          value: 'EXPLAIN ANALYZE SELECT ... -- 仍走 Seq Scan，索引未被使用',
        },
      ],
      note: '實驗失敗：查詢條件無法命中索引，延遲無明顯下降。',
      parentId: root,
      position: { x: 0, y: 0 },
    },
    {
      id: algo,
      title: '改用覆蓋索引重寫查詢',
      status: 'hypothesis',
      progress: 10,
      evidence: [],
      note: '此節點為上方被推翻假設的下游，將被標記為懸空。',
      parentId: index,
      position: { x: 0, y: 0 },
    },
    {
      id: pool,
      title: '連線池大小對延遲的影響',
      status: 'experimenting',
      progress: 55,
      evidence: [
        {
          id: uid(),
          type: 'dataset',
          label: '初步量測',
          annotation: 'A/B 測試結果不一致，需釐清負載差異',
          value: 'A 組: 池=20 較快；B 組: 池=20 較慢',
        },
      ],
      note: '正在進行不同負載下的連線池實驗。',
      parentId: root,
      position: { x: 0, y: 0 },
    },
  ];

  return nodes;
}
