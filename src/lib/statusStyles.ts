import type { NodeStatus } from '../types';

export interface StatusStyle {
  label: string;
  icon: string;
  /** 邊框 + 背景 + 文字 的 tailwind class */
  className: string;
  /** 圓點顏色 */
  dot: string;
  edgeStroke: string;
}

export const STATUS_STYLES: Record<NodeStatus, StatusStyle> = {
  hypothesis: {
    label: '假設中',
    icon: '?',
    className:
      'border-dashed border-yellow-400/70 bg-yellow-400/10 text-yellow-100',
    dot: 'bg-yellow-400',
    edgeStroke: '#facc15',
  },
  experimenting: {
    label: '實驗中',
    icon: '🧪',
    className:
      'border-solid border-sky-400/80 bg-sky-400/10 text-sky-100',
    dot: 'bg-sky-400',
    edgeStroke: '#38bdf8',
  },
  validated: {
    label: '已證實',
    icon: '✓',
    className: 'border-solid border-green-500/70 bg-green-500/10 text-green-100',
    dot: 'bg-green-500',
    edgeStroke: '#22c55e',
  },
  falsified: {
    label: '已推翻',
    icon: '✕',
    className:
      'border-solid border-red-500/50 bg-slate-700/40 text-slate-400 line-through opacity-70',
    dot: 'bg-red-500',
    edgeStroke: '#ef4444',
  },
};

export const STATUS_ORDER: NodeStatus[] = [
  'hypothesis',
  'experimenting',
  'validated',
  'falsified',
];
