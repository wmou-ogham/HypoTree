export type NodeStatus =
  | 'hypothesis'
  | 'validated'
  | 'falsified'
  | 'experimenting';

export type DerivedStatus = 'supported' | 'orphaned';

export type EvidenceType = 'citation' | 'image' | 'code' | 'dataset';

export interface CheckItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Evidence {
  id: string;
  type: EvidenceType;
  /** 顯示用標題，例如「主要文獻」或「延遲量測」 */
  label: string;
  /** 文獻網址、Code、CSV/JSON 摘要等 */
  value: string;
  /** 閱讀文獻後的心得或注記 */
  annotation?: string;
  /** 新增日期 YYYY-MM-DD（不匯出至 Markdown） */
  date?: string;
  /** 圖片附件存於 Dexie 的鍵值（type === 'image' 時使用） */
  blobKey?: string;
}

export interface ResearchNode {
  id: string;
  title: string;
  status: NodeStatus;
  /** 實驗進度 0-100（有 checkItems 時由完成比例自動計算） */
  progress?: number;
  /** 驗證步驟 checklist（與節點狀態分開） */
  checkItems?: CheckItem[];
  evidence: Evidence[];
  note?: string;
  /** 此節點是否為「研究日誌」節點 */
  isLog?: boolean;
  /** 日誌節點的日期 (YYYY-MM-DD) */
  logDate?: string;
  /** 是否收合子樹 */
  collapsed?: boolean;
  /** 父節點 id；root 節點為 null */
  parentId: string | null;
  position: { x: number; y: number };
}

/** 含衍生狀態的節點（推論崩塌計算後產生，不落地儲存） */
export interface ComputedNode extends ResearchNode {
  derived: DerivedStatus;
  /** 造成懸空的最近祖先（被推翻的節點）id */
  collapsedBy?: string;
}

export interface TreeDocument {
  version: 1;
  name: string;
  nodes: ResearchNode[];
  updatedAt: string;
}
