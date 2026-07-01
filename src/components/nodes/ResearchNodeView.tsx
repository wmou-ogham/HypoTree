import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ComputedNode } from '../../types';
import { STATUS_STYLES } from '../../lib/statusStyles';
import { useTreeStore } from '../../store/useTreeStore';

export type ResearchNodeData = ComputedNode & {
  childCount: number;
};

function ResearchNodeViewImpl({ id, data, selected }: NodeProps) {
  const node = data as unknown as ResearchNodeData;
  const style = STATUS_STYLES[node.status];
  const isOrphaned = node.derived === 'orphaned';

  const toggleCollapse = useTreeStore((s) => s.toggleCollapse);

  const progress = node.progress ?? 0;

  return (
    <div
      className={[
        'nopan nodrag relative rounded-xl border-2 px-3 py-2 shadow-lg transition-all w-[240px]',
        style.className,
        selected ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-900' : '',
        isOrphaned ? 'opacity-40 saturate-50' : '',
      ].join(' ')}
      title={isOrphaned ? '失去支撐：此推論的上游已被推翻' : node.note}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-500" />
      <Handle type="source" position={Position.Right} className="!bg-slate-500" />

      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] text-slate-900 ${style.dot}`}
        >
          {style.icon}
        </span>
        <span className="text-sm font-medium leading-snug break-words">{node.title}</span>
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
        <span>{style.label}</span>
        <span className="rounded bg-slate-900/60 px-1 py-0.5">進度 {progress}%</span>
      </div>

      {progress > 0 && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-sky-500/80 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {isOrphaned && (
        <div className="mt-1 rounded bg-red-900/40 px-1.5 py-0.5 text-[10px] text-red-300">
          ⛓️‍💥 失去支撐
        </div>
      )}

      {node.evidence.length > 0 && (
        <div className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-semibold text-white shadow">
          {node.evidence.length}
        </div>
      )}

      {node.childCount > 0 && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapse(id);
          }}
          className="absolute -right-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
          title={node.collapsed ? '展開子節點' : '收合子節點'}
        >
          {node.collapsed ? `+${node.childCount}` : '−'}
        </button>
      )}
    </div>
  );
}

export const ResearchNodeView = memo(ResearchNodeViewImpl);
