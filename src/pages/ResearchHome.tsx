import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createDocument,
  deleteDocument,
  documentExists,
  listDocuments,
  migrateLegacyMainIfNeeded,
  type ResearchSummary,
} from '../lib/persistence';
import { createSeedNodes } from '../lib/seed';
import { bootstrapResearch } from '../store/useTreeStore';
import { ensureUniqueSlug, researchPath } from '../lib/slug';

export function ResearchHome() {
  const navigate = useNavigate();
  const [researches, setResearches] = useState<ResearchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    await migrateLegacyMainIfNeeded();
    const list = await listDocuments();
    setResearches(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;

    setCreating(true);
    try {
      const existing = new Set((await listDocuments()).map((r) => r.id));
      const slug = ensureUniqueSlug(name, existing);
      await bootstrapResearch(slug, name);
      navigate(researchPath(slug));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`確定要刪除研究「${name}」？此操作無法復原。`)) return;
    await deleteDocument(id);
    await refresh();
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('zh-TW', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="text-2xl">🌲</span>
          <div>
            <h1 className="text-xl font-bold">HypoTree</h1>
            <p className="text-sm text-slate-400">研究問題樹狀心智圖 · 每個研究有專屬網址</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <section className="mb-10 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">建立新研究</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="研究名稱，例如：如何降低 API 延遲"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={!newName.trim() || creating}
              className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
            >
              {creating ? '建立中…' : '建立並開啟'}
            </button>
          </form>
          <p className="mt-2 text-xs text-slate-500">
            將依名稱產生專屬網址（如 <code className="text-slate-400">/r/如何降低-api-延遲</code>
            ），資料存在本機瀏覽器，可書籤或分享連結。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-300">
            我的研究 {researches.length > 0 && `(${researches.length})`}
          </h2>

          {loading ? (
            <p className="text-sm text-slate-500">載入中…</p>
          ) : researches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 py-12 text-center text-sm text-slate-500">
              尚無研究，請在上方輸入名稱建立第一個。
              <div className="mt-4">
                <Link
                  to={researchPath('demo')}
                  className="text-sky-400 hover:underline"
                  onClick={async (e) => {
                    e.preventDefault();
                    if (!(await documentExists('demo'))) {
                      await createDocument(
                        'demo',
                        '降低 API 延遲（示範）',
                        createSeedNodes()
                      );
                    }
                    navigate(researchPath('demo'));
                  }}
                >
                  或開啟示範研究 →
                </Link>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {researches.map((r) => (
                <li
                  key={r.id}
                  className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 transition hover:border-slate-600 hover:bg-slate-900/70"
                >
                  <Link to={researchPath(r.id)} className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-100">{r.name}</div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                      <span>{r.nodeCount} 個節點</span>
                      <span>更新於 {formatDate(r.updatedAt)}</span>
                      <span className="truncate font-mono text-slate-600">{researchPath(r.id)}</span>
                    </div>
                  </Link>
                  <button
                    onClick={() => void handleDelete(r.id, r.name)}
                    className="shrink-0 rounded px-2 py-1 text-xs text-slate-500 opacity-0 transition hover:bg-red-900/40 hover:text-red-300 group-hover:opacity-100"
                    title="刪除研究"
                  >
                    刪除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
