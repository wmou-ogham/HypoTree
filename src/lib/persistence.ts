import Dexie, { type Table } from 'dexie';
import type { ResearchNode } from '../types';
import { ensureUniqueSlug } from './slug';

export interface DocRow {
  id: string;
  name: string;
  nodes: ResearchNode[];
  updatedAt: string;
}

interface BlobRow {
  key: string;
  blob: Blob;
}

const LEGACY_MAIN_ID = 'main';

class HypoTreeDB extends Dexie {
  docs!: Table<DocRow, string>;
  blobs!: Table<BlobRow, string>;

  constructor() {
    super('hypotree');
    this.version(1).stores({
      docs: 'id',
      blobs: 'key',
    });
  }
}

export const db = new HypoTreeDB();

export interface ResearchSummary {
  id: string;
  name: string;
  updatedAt: string;
  nodeCount: number;
}

export async function listDocuments(): Promise<ResearchSummary[]> {
  const rows = await db.docs.toArray();
  return rows
    .filter((r) => r.id !== LEGACY_MAIN_ID)
    .map((r) => ({
      id: r.id,
      name: r.name,
      updatedAt: r.updatedAt,
      nodeCount: r.nodes.length,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadDocument(
  id: string
): Promise<{ id: string; name: string; nodes: ResearchNode[] } | null> {
  const row = await db.docs.get(id);
  if (!row) return null;
  return { id: row.id, name: row.name, nodes: row.nodes };
}

export async function saveDocument(
  id: string,
  name: string,
  nodes: ResearchNode[]
): Promise<void> {
  await db.docs.put({
    id,
    name,
    nodes,
    updatedAt: new Date().toISOString(),
  });
}

export async function createDocument(
  id: string,
  name: string,
  nodes: ResearchNode[]
): Promise<void> {
  await saveDocument(id, name, nodes);
}

export async function deleteDocument(id: string): Promise<void> {
  await db.docs.delete(id);
}

/** 將舊版單一 main 文件遷移為以 slug 為 id 的多研究格式；回傳新 slug 或 null */
export async function migrateLegacyMainIfNeeded(): Promise<string | null> {
  const legacy = await db.docs.get(LEGACY_MAIN_ID);
  if (!legacy) return null;

  const existing = new Set(
    (await db.docs.toArray())
      .map((d) => d.id)
      .filter((id) => id !== LEGACY_MAIN_ID)
  );
  const newId = ensureUniqueSlug(legacy.name || 'hypotree', existing);

  if (!existing.has(newId)) {
    await db.docs.put({ ...legacy, id: newId });
  }
  await db.docs.delete(LEGACY_MAIN_ID);
  return newId;
}

export async function documentExists(id: string): Promise<boolean> {
  return (await db.docs.get(id)) != null;
}

/** 儲存圖片附件並回傳其鍵值（全域 blob 池，跨研究共用） */
export async function saveBlob(blob: Blob): Promise<string> {
  const key = `blob_${crypto.randomUUID()}`;
  await db.blobs.put({ key, blob });
  return key;
}

export async function getBlobUrl(key: string): Promise<string | null> {
  const row = await db.blobs.get(key);
  if (!row) return null;
  return URL.createObjectURL(row.blob);
}

export async function deleteBlob(key: string): Promise<void> {
  await db.blobs.delete(key);
}
