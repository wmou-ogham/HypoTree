import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTreeStore } from '../store/useTreeStore';
import { exportMarkdown, importMarkdown, migrateNode } from '../lib/markdown';
import { copyResearchUrl } from '../pages/ResearchEditor';
import { pngExportTrigger } from './Canvas';
import { researchPath } from '../lib/slug';
import type { ResearchNode, TreeDocument } from '../types';

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface ToolbarProps {
  slug: string;
}

export function Toolbar({ slug }: ToolbarProps) {
  const docName = useTreeStore((s) => s.docName);
  const setDocName = useTreeStore((s) => s.setDocName);
  const nodes = useTreeStore((s) => s.nodes);
  const addChild = useTreeStore((s) => s.addChild);
  const replaceAll = useTreeStore((s) => s.replaceAll);
  const relayout = useTreeStore((s) => s.relayout);
  const undo = useTreeStore((s) => s.undo);
  const redo = useTreeStore((s) => s.redo);

  const fileRef = useRef<HTMLInputElement>(null);
  const [exportingPng, setExportingPng] = useState(false);

  const handleExportPng = async () => {
    if (!pngExportTrigger.current || exportingPng) return;
    setExportingPng(true);
    try {
      await pngExportTrigger.current();
    } finally {
      setExportingPng(false);
    }
  };

  const exportJson = () => {
    const doc: TreeDocument = {
      version: 1,
      name: docName,
      nodes,
      updatedAt: new Date().toISOString(),
    };
    download(`${docName || slug}.json`, JSON.stringify(doc, null, 2), 'application/json');
  };

  const exportMd = () => {
    download(`${docName || slug}.md`, exportMarkdown(nodes), 'text/markdown');
  };

  const onImportFile = async (file: File) => {
    const text = await file.text();
    if (file.name.endsWith('.json')) {
      try {
        const doc = JSON.parse(text) as TreeDocument;
        if (Array.isArray(doc.nodes))
          replaceAll(doc.nodes.map(migrateNode) as ResearchNode[], doc.name);
      } catch {
        alert('JSON 解析失敗');
      }
    } else {
      const parsed = importMarkdown(text);
      if (parsed.length) replaceAll(parsed, file.name.replace(/\.md$/, ''));
      else alert('Markdown 中找不到任務列表節點');
    }
  };

  const btn =
    'rounded-md px-2.5 py-1.5 text-xs font-medium transition border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700';

  return (
    <header className="border-b border-slate-800 bg-slate-900">
    <div className="flex items-center gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link
        to="/"
        className="flex items-center gap-2 pr-2 text-slate-200 hover:text-white"
        title="返回研究列表"
      >
        <span className="text-lg">🌲</span>
        <span className="text-sm font-bold">HypoTree</span>
      </Link>

      <input
        value={docName}
        onChange={(e) => setDocName(e.target.value)}
        className="w-48 rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-sky-500"
        title="研究顯示名稱（網址 slug 建立時固定）"
      />

      <button
        type="button"
        className="hidden max-w-[180px] truncate rounded bg-slate-800/60 px-2 py-1 font-mono text-[10px] text-slate-500 hover:bg-slate-800 hover:text-slate-300 md:block"
        title="點擊複製研究網址"
        onClick={() => {
          copyResearchUrl(slug);
        }}
      >
        {researchPath(slug)}
      </button>

      <div className="mx-2 hidden h-5 w-px bg-slate-700 sm:block" />

      <button className={btn} onClick={() => addChild(null)} title="新增根節點">
        + 根節點
      </button>
      <button className={btn} onClick={relayout} title="重新排版並適應螢幕大小">
        適應螢幕
      </button>
      <button className={btn} onClick={undo} title="復原 (Cmd+Z)">
        ↶ 復原
      </button>
      <button className={btn} onClick={redo} title="重做 (Shift+Cmd+Z)">
        ↷ 重做
      </button>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button className={btn} onClick={() => fileRef.current?.click()}>
          匯入 .json/.md
        </button>
        <button className={btn} onClick={exportMd}>
          匯出 Markdown
        </button>
        <button
          className="rounded-md border border-sky-600 bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
          onClick={exportJson}
        >
          匯出 JSON
        </button>
        <button
          className="rounded-md border border-violet-500 bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleExportPng}
          disabled={exportingPng}
          title="fit 畫面後匯出為 PNG（含 hypotree 浮水印）"
        >
          {exportingPng ? '匯出中…' : '匯出 PNG'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.md,.markdown"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImportFile(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
    </header>
  );
}
