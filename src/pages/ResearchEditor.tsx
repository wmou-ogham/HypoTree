import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import { Toolbar } from '../components/Toolbar';
import { Canvas } from '../components/Canvas';
import { EvidencePanel } from '../components/sidebar/EvidencePanel';
import { useTreeStore } from '../store/useTreeStore';
import { useGlobalHotkeys } from '../hooks/useHotkeys';
import { researchPath } from '../lib/slug';

const HOTKEY_HINTS: { keys: string; desc: string }[] = [
  { keys: 'Tab', desc: '子節點（下一級）' },
  { keys: 'Enter', desc: '標題 → 備註' },
  { keys: '⇧Enter', desc: '同層節點' },
  { keys: '⇧Click', desc: '多選' },
  { keys: 'X', desc: '已推翻' },
  { keys: 'V', desc: '已證實' },
  { keys: 'C', desc: '實驗中' },
  { keys: '⌫', desc: '刪除' },
  { keys: '⌘Z', desc: '復原' },
];

function HotkeyLabel({ keys }: { keys: string }) {
  if (!keys.includes('⇧')) {
    return <>{keys}</>;
  }
  const rest = keys.replace(/^⇧/, '');
  return (
    <>
      <span className="text-base leading-none">⇧</span>
      {rest}
    </>
  );
}

export function ResearchEditor() {
  const { slug: rawSlug } = useParams<{ slug: string }>();
  const slug = rawSlug ? decodeURIComponent(rawSlug) : null;

  const loaded = useTreeStore((s) => s.loaded);
  const loadResearch = useTreeStore((s) => s.loadResearch);
  const resetEditorState = useTreeStore((s) => s.resetEditorState);

  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useGlobalHotkeys();

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    resetEditorState();

    void (async () => {
      const ok = await loadResearch(slug);
      if (cancelled) return;
      setNotFound(!ok);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
      resetEditorState();
    };
  }, [slug, loadResearch, resetEditorState]);

  if (!slug) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950 text-slate-500">
        載入研究…
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-950 text-slate-400">
        <p>找不到研究「{slug}」</p>
        <p className="text-xs text-slate-600">此網址可能尚未建立，或已在其他瀏覽器清除資料。</p>
        <Link to="/" className="text-sky-400 hover:underline">
          ← 返回研究列表
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <Toolbar slug={slug} />
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          {loaded ? (
            <ReactFlowProvider>
              <Canvas />
            </ReactFlowProvider>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500">
              載入中…
            </div>
          )}
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap gap-2">
            {HOTKEY_HINTS.map((h) => (
              <span
                key={h.keys}
                className="rounded bg-slate-800/90 px-2.5 py-1 text-[11px] text-slate-400 backdrop-blur"
              >
                <kbd className="font-semibold text-slate-100">
                  <HotkeyLabel keys={h.keys} />
                </kbd>{' '}
                {h.desc}
              </span>
            ))}
          </div>
        </main>
        <EvidencePanel />
      </div>
    </div>
  );
}

/** 複製目前研究網址到剪貼簿 */
export function copyResearchUrl(slug: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const url = `${window.location.origin}${base}${researchPath(slug)}`;
  void navigator.clipboard.writeText(url);
}
