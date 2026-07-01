import { useEffect, useRef, useState } from 'react';
import type { ComputedNode, EvidenceType, NodeStatus } from '../../types';
import { useTreeStore } from '../../store/useTreeStore';
import { STATUS_ORDER, STATUS_STYLES } from '../../lib/statusStyles';
import { getBlobUrl, saveBlob } from '../../lib/persistence';
import { computeDerivedStatus } from '../../lib/inference';

const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  citation: '文獻引用',
  image: '實驗圖片',
  code: 'Code',
  dataset: '數據摘要 (CSV/JSON)',
};

function renderCitationLink(value: string) {
  const v = value.trim();
  if (!v) return null;
  let href = v;
  if (/^10\.\d{4,}\//.test(v)) href = `https://doi.org/${v}`;
  else if (/^arxiv:/i.test(v)) href = `https://arxiv.org/abs/${v.replace(/^arxiv:/i, '')}`;
  if (/^https?:\/\//.test(href) || href !== v) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="break-all text-sky-400 hover:underline"
      >
        {v}
      </a>
    );
  }
  return <span className="break-all text-slate-300">{v}</span>;
}

function ImageEvidence({ blobKey }: { blobKey: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    getBlobUrl(blobKey).then((u) => {
      revoke = u;
      setUrl(u);
    });
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [blobKey]);
  if (!url) return <div className="text-xs text-slate-500">載入圖片中…</div>;
  return <img src={url} alt="實驗圖表" className="max-h-48 w-full rounded object-contain" />;
}

function StatusGrid({
  activeStatus,
  onPick,
  hint,
}: {
  activeStatus?: string | null;
  onPick: (status: NodeStatus) => void;
  hint?: string;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        驗證狀態
      </h3>
      {hint && <p className="mb-2 text-[11px] text-slate-500">{hint}</p>}
      <div className="grid grid-cols-2 gap-2">
        {STATUS_ORDER.map((s) => {
          const st = STATUS_STYLES[s];
          const active = activeStatus === s;
          return (
            <button
              key={s}
              type="button"
              tabIndex={-1}
              onClick={() => onPick(s)}
              className={[
                'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition',
                active
                  ? 'border-sky-500 bg-slate-700 text-white'
                  : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50',
              ].join(' ')}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${st.dot}`} />
              <span>{st.icon}</span>
              {st.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function EvidencePanel() {
  const selectedId = useTreeStore((s) => s.selectedId);
  const selectedIds = useTreeStore((s) => s.selectedIds);
  const editingId = useTreeStore((s) => s.editingId);
  const nodes = useTreeStore((s) => s.nodes);
  const setEditing = useTreeStore((s) => s.setEditing);
  const updateNode = useTreeStore((s) => s.updateNode);
  const commitTitleEdit = useTreeStore((s) => s.commitTitleEdit);
  const setStatusForSelected = useTreeStore((s) => s.setStatusForSelected);
  const addEvidence = useTreeStore((s) => s.addEvidence);
  const updateEvidence = useTreeStore((s) => s.updateEvidence);
  const removeEvidence = useTreeStore((s) => s.removeEvidence);
  const removeNode = useTreeStore((s) => s.removeNode);
  const addChild = useTreeStore((s) => s.addChild);
  const addSibling = useTreeStore((s) => s.addSibling);

  const titleRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const blurField = () => {
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const finishTitleEdit = () => {
    commitTitleEdit();
    blurField();
  };

  const computed = computeDerivedStatus(nodes);
  const isMulti = selectedIds.length > 1;
  const node = !isMulti
    ? (computed.find((n) => n.id === selectedIds[0]) as ComputedNode | undefined)
    : undefined;
  const selectedNodes = isMulti
    ? computed.filter((n) => selectedIds.includes(n.id))
    : [];

  const uniformStatus =
    isMulti && selectedNodes.length > 0
      ? selectedNodes.every((n) => n.status === selectedNodes[0].status)
        ? selectedNodes[0].status
        : null
      : null;

  const [newType, setNewType] = useState<EvidenceType>('citation');
  const [newLabel, setNewLabel] = useState('');
  const [newAnnotation, setNewAnnotation] = useState('');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    if (editingId && editingId === selectedId && titleRef.current) {
      requestAnimationFrame(() => {
        titleRef.current?.focus();
        titleRef.current?.select();
      });
    }
  }, [editingId, selectedId]);

  if (!selectedIds.length) {
    return (
      <aside className="flex h-full w-[340px] shrink-0 flex-col items-center justify-center border-l border-slate-800 bg-slate-900/60 p-6 text-center text-sm text-slate-500">
        <div className="mb-2 text-3xl">🔬</div>
        點選一個節點以檢視並編輯
        <br />
        <span className="mt-2 text-xs text-slate-600">按住 Shift 點擊可多選，批次修改狀態</span>
      </aside>
    );
  }

  if (isMulti) {
    return (
      <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-slate-800 bg-slate-900/60">
        <div className="border-b border-slate-800 p-4">
          <h2 className="text-sm font-semibold text-slate-100">
            已選取 {selectedIds.length} 個節點
          </h2>
          <p className="mt-1 text-xs text-slate-500">點選下方狀態以批次套用</p>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <StatusGrid
            activeStatus={uniformStatus}
            onPick={setStatusForSelected}
            hint={
              uniformStatus === null
                ? '選取的節點狀態不一致，點選以統一設定'
                : undefined
            }
          />
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              選取清單
            </h3>
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/40 p-2">
              {selectedNodes.map((n) => (
                <li
                  key={n.id}
                  className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs text-slate-300"
                >
                  <span className="truncate">{n.title}</span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${STATUS_STYLES[n.status].dot} text-slate-900`}
                  >
                    {STATUS_STYLES[n.status].label}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    );
  }

  if (!node) {
    return (
      <aside className="flex h-full w-[340px] shrink-0 flex-col items-center justify-center border-l border-slate-800 bg-slate-900/60 p-6 text-center text-sm text-slate-500">
        找不到選取的節點
      </aside>
    );
  }

  const handleAddEvidence = () => {
    if (!newValue.trim() && !newAnnotation.trim() && newType !== 'image') return;
    addEvidence(node.id, {
      type: newType,
      label: newLabel.trim() || EVIDENCE_TYPE_LABELS[newType],
      value: newValue.trim(),
      annotation: newAnnotation.trim() || undefined,
    });
    setNewLabel('');
    setNewAnnotation('');
    setNewValue('');
  };

  const handleImageUpload = async (file: File) => {
    const key = await saveBlob(file);
    addEvidence(node.id, {
      type: 'image',
      label: file.name,
      value: '',
      blobKey: key,
    });
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (item) {
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        await handleImageUpload(file);
      }
    }
  };

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-slate-800 bg-slate-900/60">
      <div className="border-b border-slate-800 p-4">
        {editingId === node.id ? (
          <input
            ref={titleRef}
            value={node.title}
            onChange={(e) => updateNode(node.id, { title: e.target.value })}
            onBlur={() => commitTitleEdit()}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                commitTitleEdit();
                addChild(node.id);
                return;
              }
              if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                commitTitleEdit();
                addSibling(node.id);
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                finishTitleEdit();
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                finishTitleEdit();
              }
            }}
            className="w-full rounded bg-slate-800 px-2 py-1.5 text-sm font-semibold text-slate-100 outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="節點標題"
          />
        ) : (
          <h2
            className="cursor-text rounded px-2 py-1.5 text-sm font-semibold text-slate-100 hover:bg-slate-800/60"
            onDoubleClick={() => setEditing(node.id)}
            title="雙擊或按 Enter 編輯標題"
          >
            {node.title}
          </h2>
        )}
        {node.derived === 'orphaned' && (
          <div className="mt-2 rounded bg-red-900/40 px-2 py-1 text-xs text-red-300">
            ⛓️‍💥 此節點失去支撐：上游推論已被推翻
          </div>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4" onPaste={handlePaste}>
        <StatusGrid activeStatus={node.status} onPick={setStatusForSelected} />

        <section>
          <h3 className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span>實驗進度</span>
            <span className="text-sky-400">{node.progress ?? 0}%</span>
          </h3>
          <input
            type="range"
            tabIndex={-1}
            min={0}
            max={100}
            step={5}
            value={node.progress ?? 0}
            onChange={(e) => updateNode(node.id, { progress: Number(e.target.value) })}
            className="w-full accent-sky-500"
          />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            備註
          </h3>
          <textarea
            ref={noteRef}
            value={node.note ?? ''}
            onChange={(e) => updateNode(node.id, { note: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                addChild(node.id);
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                blurField();
              }
            }}
            rows={3}
            placeholder="備註內容…"
            tabIndex={-1}
            className="w-full resize-y rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-sky-500"
          />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            證據與文獻 ({node.evidence.length})
          </h3>
          <div className="space-y-2">
            {node.evidence.map((e) => (
              <div key={e.id} className="rounded-lg border border-slate-700 bg-slate-800/50 p-2">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={e.date ?? ''}
                    onChange={(ev) => updateEvidence(node.id, e.id, { date: ev.target.value })}
                    className="rounded bg-slate-900/50 px-2 py-1 text-[10px] text-slate-400 outline-none focus:ring-1 focus:ring-sky-500"
                    title="新增日期"
                  />
                  <input
                    value={e.label}
                    onChange={(ev) => updateEvidence(node.id, e.id, { label: ev.target.value })}
                    placeholder="標題"
                    className="min-w-0 flex-1 rounded bg-slate-900/50 px-2 py-1 text-xs font-medium text-slate-200 outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  <span className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">
                    {EVIDENCE_TYPE_LABELS[e.type]}
                  </span>
                  <button
                    onClick={() => removeEvidence(node.id, e.id)}
                    className="shrink-0 text-slate-500 hover:text-red-400"
                    title="刪除"
                  >
                    ✕
                  </button>
                </div>

                <label className="mb-1 block text-[10px] text-slate-500">心得 / 注記</label>
                <textarea
                  value={e.annotation ?? ''}
                  onChange={(ev) =>
                    updateEvidence(node.id, e.id, { annotation: ev.target.value })
                  }
                  rows={2}
                  placeholder="閱讀文獻後的心得或注記…"
                  className="mb-2 w-full resize-y rounded bg-slate-900/70 px-2 py-1 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-sky-500"
                />

                {e.type === 'image' && e.blobKey ? (
                  <ImageEvidence blobKey={e.blobKey} />
                ) : e.type === 'citation' ? (
                  <div className="space-y-1">
                    <label className="block text-[10px] text-slate-500">文獻網址</label>
                    <input
                      value={e.value}
                      onChange={(ev) => updateEvidence(node.id, e.id, { value: ev.target.value })}
                      placeholder="DOI / ArXiv / Zotero 連結"
                      className="w-full rounded bg-slate-900/70 px-2 py-1 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    {renderCitationLink(e.value)}
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-[10px] text-slate-500">內容</label>
                    <textarea
                      value={e.value}
                      onChange={(ev) => updateEvidence(node.id, e.id, { value: ev.target.value })}
                      rows={e.type === 'code' ? 4 : 2}
                      className={`w-full resize-y rounded bg-slate-900/70 px-2 py-1 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-sky-500 ${
                        e.type === 'code' ? 'font-mono' : ''
                      }`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-dashed border-slate-700 p-2">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as EvidenceType)}
              className="mb-2 w-full rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none"
            >
              {(Object.keys(EVIDENCE_TYPE_LABELS) as EvidenceType[]).map((t) => (
                <option key={t} value={t}>
                  {EVIDENCE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>

            {newType === 'image' ? (
              <label className="block cursor-pointer rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-center text-xs text-slate-300 hover:bg-slate-700">
                點此上傳圖片，或在面板上直接貼上 (Ctrl/Cmd+V)
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleImageUpload(f);
                  }}
                />
              </label>
            ) : (
              <>
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="標題"
                  className="mb-1 w-full rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none"
                />
                <textarea
                  value={newAnnotation}
                  onChange={(e) => setNewAnnotation(e.target.value)}
                  placeholder="心得 / 注記（選填）"
                  rows={2}
                  className="mb-1 w-full resize-y rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none"
                />
                <input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={
                    newType === 'citation'
                      ? '文獻網址 (DOI / ArXiv / Zotero)'
                      : newType === 'code'
                      ? 'Code 內容'
                      : 'CSV / JSON 摘要'
                  }
                  className="mb-1 w-full rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none"
                />
                <button
                  onClick={handleAddEvidence}
                  className="w-full rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-500"
                >
                  新增證據
                </button>
              </>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-slate-800 p-3">
        <button
          onClick={() => addChild(node.id)}
          className="rounded bg-slate-700 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-600"
        >
          + 子節點
        </button>
        <button
          onClick={() => removeNode(node.id)}
          className="rounded bg-red-900/60 px-2 py-1.5 text-xs text-red-200 hover:bg-red-800"
        >
          刪除
        </button>
      </div>
    </aside>
  );
}
