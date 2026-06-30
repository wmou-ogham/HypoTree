import { create } from 'zustand';
import type { ComputedNode, Evidence, NodeStatus, ResearchNode } from '../types';
import { computeDerivedStatus } from '../lib/inference';
import { layoutTree } from '../lib/layout';
import {
  createDocument,
  loadDocument,
  saveDocument,
} from '../lib/persistence';
import { createEmptyResearch, createSeedNodes } from '../lib/seed';
import { migrateNode } from '../lib/markdown';
import { syncStatusWithEvidence, syncAllNodesEvidenceStatus } from '../lib/statusSync';

const uid = () => crypto.randomUUID();
const HISTORY_LIMIT = 50;
const todayISO = () => new Date().toISOString().slice(0, 10);

interface TreeState {
  researchSlug: string | null;
  docName: string;
  nodes: ResearchNode[];
  selectedId: string | null;
  selectedIds: string[];
  loaded: boolean;
  editingId: string | null;
  /** 標題已確認，下一次 Enter 聚焦備註 */
  titleCommitted: boolean;
  /** 遞增以觸發備註欄聚焦 */
  noteFocusToken: number;
  /** 遞增以觸發畫布 fitView */
  fitViewRequest: number;
  past: ResearchNode[][];
  future: ResearchNode[][];

  loadResearch: (slug: string, options?: { useSeedIfEmpty?: boolean }) => Promise<boolean>;
  computed: () => ComputedNode[];

  select: (id: string | null, options?: { shiftKey?: boolean }) => void;
  setEditing: (id: string | null) => void;
  commitTitleEdit: () => void;
  requestNoteFocus: () => void;
  setDocName: (name: string) => void;

  addChild: (parentId: string | null, partial?: Partial<ResearchNode>) => string;
  addSibling: (id: string) => string;
  updateNode: (id: string, patch: Partial<ResearchNode>) => void;
  setStatus: (id: string, status: NodeStatus) => void;
  setStatusForSelected: (status: NodeStatus) => void;
  removeNode: (id: string) => void;
  removeSelected: () => void;
  setParent: (id: string, parentId: string) => void;
  toggleCollapse: (id: string) => void;

  addEvidence: (nodeId: string, ev: Omit<Evidence, 'id'>) => void;
  updateEvidence: (nodeId: string, evId: string, patch: Partial<Evidence>) => void;
  removeEvidence: (nodeId: string, evId: string) => void;

  replaceAll: (nodes: ResearchNode[], name?: string) => void;
  relayout: () => void;
  undo: () => void;
  redo: () => void;
  resetEditorState: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useTreeStore = create<TreeState>((set, get) => {
  const persist = () => {
    const { researchSlug, docName, nodes } = get();
    if (!researchSlug) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void saveDocument(researchSlug, docName, nodes);
    }, 400);
  };

  const withLayout = (nodes: ResearchNode[]): ResearchNode[] => {
    const pos = layoutTree(nodes);
    return nodes.map((n) => (pos[n.id] ? { ...n, position: pos[n.id] } : n));
  };

  const commit = (updater: (nodes: ResearchNode[]) => ResearchNode[]) => {
    set((state) => {
      const next = withLayout(updater(state.nodes));
      return {
        nodes: next,
        past: [...state.past, state.nodes].slice(-HISTORY_LIMIT),
        future: [],
      };
    });
    persist();
  };

  return {
    researchSlug: null,
    docName: '',
    nodes: [],
    selectedId: null,
    selectedIds: [],
    loaded: false,
    editingId: null,
    titleCommitted: false,
    noteFocusToken: 0,
    fitViewRequest: 0,
    past: [],
    future: [],

    resetEditorState: () => {
      if (saveTimer) clearTimeout(saveTimer);
      set({
        researchSlug: null,
        docName: '',
        nodes: [],
        selectedId: null,
        selectedIds: [],
        loaded: false,
        editingId: null,
        titleCommitted: false,
        noteFocusToken: 0,
        fitViewRequest: 0,
        past: [],
        future: [],
      });
    },

    loadResearch: async (slug, options) => {
      set({ loaded: false, researchSlug: slug });
      const doc = await loadDocument(slug);

      if (doc && doc.nodes.length) {
        const migrated = withLayout(
          syncAllNodesEvidenceStatus(doc.nodes.map(migrateNode))
        );
        set({
          researchSlug: slug,
          docName: doc.name,
          nodes: migrated,
          loaded: true,
          selectedId: migrated[0]?.id ?? null,
          selectedIds: migrated[0]?.id ? [migrated[0].id] : [],
          editingId: null,
          past: [],
          future: [],
          fitViewRequest: 1,
        });
        return true;
      }

      if (options?.useSeedIfEmpty && slug === 'demo') {
        const seed = withLayout(createSeedNodes());
        set({
          researchSlug: slug,
          docName: '降低 API 延遲（示範）',
          nodes: seed,
          loaded: true,
          selectedId: seed[0]?.id ?? null,
          selectedIds: seed[0]?.id ? [seed[0].id] : [],
          editingId: null,
          past: [],
          future: [],
          fitViewRequest: 1,
        });
        void saveDocument(slug, get().docName, seed);
        return true;
      }

      return false;
    },

    computed: () => computeDerivedStatus(get().nodes),

    select: (id, options) => {
      if (id === null) {
        set({ selectedId: null, selectedIds: [], editingId: null, titleCommitted: false });
        return;
      }
      if (options?.shiftKey) {
        set((s) => {
          const next = new Set(s.selectedIds);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          const selectedIds = [...next];
          return {
            selectedIds,
            selectedId: selectedIds.length ? id : null,
            editingId: null,
            titleCommitted: false,
          };
        });
        return;
      }
      set({
        selectedId: id,
        selectedIds: [id],
        editingId: null,
        titleCommitted: false,
      });
    },
    setEditing: (id) => set({ editingId: id, ...(id ? { titleCommitted: false } : {}) }),
    commitTitleEdit: () => set({ editingId: null, titleCommitted: true }),
    requestNoteFocus: () =>
      set((s) => ({ noteFocusToken: s.noteFocusToken + 1, titleCommitted: false })),
    setDocName: (name) => {
      set({ docName: name });
      persist();
    },

    addChild: (parentId, partial) => {
      const id = uid();
      commit((nodes) => [
        ...nodes,
        {
          id,
          title: partial?.title ?? '新節點',
          status: partial?.status ?? 'hypothesis',
          progress: partial?.progress ?? 0,
          evidence: [],
          parentId,
          position: { x: 0, y: 0 },
          ...partial,
        },
      ]);
      set({ selectedId: id, selectedIds: [id], editingId: id, titleCommitted: false });
      return id;
    },

    addSibling: (siblingId) => {
      const sib = get().nodes.find((n) => n.id === siblingId);
      return get().addChild(sib?.parentId ?? null);
    },

    updateNode: (id, patch) => {
      commit((nodes) => nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    },

    setStatus: (id, status) => {
      commit((nodes) => nodes.map((n) => (n.id === id ? { ...n, status } : n)));
    },

    setStatusForSelected: (status) => {
      const ids = new Set(get().selectedIds);
      if (!ids.size) return;
      commit((nodes) =>
        nodes.map((n) => (ids.has(n.id) ? { ...n, status } : n))
      );
    },

    removeNode: (id) => {
      commit((nodes) => {
        const toRemove = new Set<string>([id]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const n of nodes) {
            if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
              toRemove.add(n.id);
              changed = true;
            }
          }
        }
        return nodes.filter((n) => !toRemove.has(n.id));
      });
      set((s) => {
        const selectedIds = s.selectedIds.filter((sid) => sid !== id);
        const selectedId =
          s.selectedId === id ? selectedIds[selectedIds.length - 1] ?? null : s.selectedId;
        return { selectedIds, selectedId };
      });
    },

    removeSelected: () => {
      const roots = get().selectedIds;
      if (!roots.length) return;
      commit((nodes) => {
        const toRemove = new Set<string>(roots);
        let changed = true;
        while (changed) {
          changed = false;
          for (const n of nodes) {
            if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
              toRemove.add(n.id);
              changed = true;
            }
          }
        }
        return nodes.filter((n) => !toRemove.has(n.id));
      });
      set({ selectedIds: [], selectedId: null, editingId: null });
    },

    setParent: (id, parentId) => {
      if (id === parentId) return;
      const nodes = get().nodes;
      let p: string | null = parentId;
      while (p) {
        if (p === id) return;
        p = nodes.find((n) => n.id === p)?.parentId ?? null;
      }
      commit((ns) => ns.map((n) => (n.id === id ? { ...n, parentId } : n)));
    },

    toggleCollapse: (id) => {
      commit((nodes) =>
        nodes.map((n) => (n.id === id ? { ...n, collapsed: !n.collapsed } : n))
      );
    },

    addEvidence: (nodeId, ev) => {
      commit((nodes) =>
        nodes.map((n) => {
          if (n.id !== nodeId) return n;
          return syncStatusWithEvidence({
            ...n,
            evidence: [...n.evidence, { ...ev, id: uid(), date: ev.date ?? todayISO() }],
          });
        })
      );
    },

    updateEvidence: (nodeId, evId, patch) => {
      commit((nodes) =>
        nodes.map((n) => {
          if (n.id !== nodeId) return n;
          return syncStatusWithEvidence({
            ...n,
            evidence: n.evidence.map((e) => (e.id === evId ? { ...e, ...patch } : e)),
          });
        })
      );
    },

    removeEvidence: (nodeId, evId) => {
      commit((nodes) =>
        nodes.map((n) => {
          if (n.id !== nodeId) return n;
          return syncStatusWithEvidence({
            ...n,
            evidence: n.evidence.filter((e) => e.id !== evId),
          });
        })
      );
    },

    replaceAll: (nodes, name) => {
      const next = withLayout(syncAllNodesEvidenceStatus(nodes.map(migrateNode)));
      set((state) => ({
        nodes: next,
        docName: name ?? state.docName,
        selectedId: next[0]?.id ?? null,
        selectedIds: next[0]?.id ? [next[0].id] : [],
        past: [...state.past, state.nodes].slice(-HISTORY_LIMIT),
        future: [],
      }));
      persist();
    },

    relayout: () => {
      set((state) => ({
        nodes: withLayout(state.nodes),
        fitViewRequest: state.fitViewRequest + 1,
      }));
      persist();
    },

    undo: () => {
      set((state) => {
        if (!state.past.length) return state;
        const previous = state.past[state.past.length - 1];
        return {
          nodes: previous,
          past: state.past.slice(0, -1),
          future: [state.nodes, ...state.future].slice(0, HISTORY_LIMIT),
        };
      });
      persist();
    },

    redo: () => {
      set((state) => {
        if (!state.future.length) return state;
        const next = state.future[0];
        return {
          nodes: next,
          future: state.future.slice(1),
          past: [...state.past, state.nodes].slice(0, HISTORY_LIMIT),
        };
      });
      persist();
    },
  };
});

/** 建立新研究並寫入 IndexedDB */
export async function bootstrapResearch(
  slug: string,
  name: string
): Promise<void> {
  const nodes = createEmptyResearch(name);
  await createDocument(slug, name, nodes);
}
