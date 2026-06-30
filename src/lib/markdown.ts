import type { Evidence, NodeStatus, ResearchNode } from '../types';

const uid = () => crypto.randomUUID();

const EXPERIMENT_MARK = '🧪';

function statusToMarkdownTitle(node: ResearchNode): string {
  const title = node.title.trim();
  switch (node.status) {
    case 'validated':
      return `[x] ${title}`;
    case 'falsified':
      return `[x] ~~${title}~~`;
    case 'experimenting':
      return `[ ] ${EXPERIMENT_MARK} ${title}`;
    case 'hypothesis':
    default:
      return `[ ] ${title}`;
  }
}

function resolveCitationUrl(value: string): string {
  const v = value.trim();
  if (/^https?:\/\//.test(v)) return v;
  if (/^10\.\d{4,}\//.test(v)) return `https://doi.org/${v}`;
  if (/^arxiv:/i.test(v)) return `https://arxiv.org/abs/${v.replace(/^arxiv:/i, '')}`;
  return v;
}

function isLinkable(value: string): boolean {
  const v = value.trim();
  return /^https?:\/\//.test(v) || /^10\.\d{4,}\//.test(v) || /^arxiv:/i.test(v);
}

function renderEvidenceLine(e: Evidence): string {
  const title = e.label.trim() || '未命名';
  const annotation = e.annotation?.trim().replace(/\s*\n\s*/g, ' ').trim() || '';

  if (e.type === 'image' && e.blobKey) {
    return annotation ? `[${title}] (圖片附件) ${annotation}` : `[${title}] (圖片附件)`;
  }

  const value = e.value.trim();

  if (e.type === 'citation' && value && isLinkable(value)) {
    const href = resolveCitationUrl(value);
    return annotation ? `[${title}](${href}) ${annotation}` : `[${title}](${href})`;
  }

  if (value && isLinkable(value)) {
    const href = resolveCitationUrl(value);
    const desc = annotation || (e.type === 'citation' ? '' : value);
    return desc ? `[${title}](${href}) ${desc}` : `[${title}](${href})`;
  }

  const content = [annotation, value].filter(Boolean).join(' ');
  return content ? `[${title}] ${content}` : `[${title}]`;
}

/** 將樹輸出為 Markdown 任務列表（含縮排子內文） */
export function exportMarkdown(nodes: ResearchNode[]): string {
  const byId = new Map<string, ResearchNode>();
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) byId.set(n.id, n);
  for (const n of nodes) {
    if (n.parentId && byId.has(n.parentId)) {
      const arr = childrenOf.get(n.parentId) ?? [];
      arr.push(n.id);
      childrenOf.set(n.parentId, arr);
    }
  }
  const roots = nodes.filter((n) => n.parentId == null || !byId.has(n.parentId));
  const lines: string[] = [];

  const walk = (id: string, depth: number) => {
    const node = byId.get(id)!;
    const indent = '  '.repeat(depth);
    lines.push(`${indent}- ${statusToMarkdownTitle(node)}`);

    const sub = indent + '  ';

    if (node.note?.trim()) {
      lines.push(`${sub}- ${node.note.replace(/\s*\n\s*/g, ' ').trim()}`);
    }

    if (typeof node.progress === 'number') {
      lines.push(`${sub}- 實驗進度: ${node.progress}%`);
    }

    for (const e of node.evidence) {
      lines.push(`${sub}- ${renderEvidenceLine(e)}`);
    }

    for (const cid of childrenOf.get(id) ?? []) walk(cid, depth + 1);
  };

  for (const r of roots) walk(r.id, 0);
  return lines.join('\n') + '\n';
}

interface ParsedLine {
  indent: number;
  type: 'task' | 'sub';
  checked?: boolean;
  text?: string;
  status?: NodeStatus;
  subText?: string;
}

function parseLine(raw: string): ParsedLine | null {
  const m = raw.match(/^(\s*)-\s+(.*)$/);
  if (!m) return null;
  const indent = m[1].replace(/\t/g, '  ').length;
  const body = m[2];

  const taskMatch = body.match(/^\[([ xX])\]\s*(.*)$/);
  if (taskMatch) {
    const checked = taskMatch[1].toLowerCase() === 'x';
    let text = taskMatch[2].trim();
    let status: NodeStatus;

    const isExperiment =
      text.startsWith(EXPERIMENT_MARK) || text.startsWith('🧪');
    if (isExperiment) text = text.replace(/^🧪\s*/, '').trim();

    const strike = text.match(/^~~(.*)~~$/);
    if (strike) text = strike[1].trim();

    if (strike) status = 'falsified';
    else if (isExperiment) status = 'experimenting';
    else if (checked) status = 'validated';
    else status = 'hypothesis';

    return { indent, type: 'task', checked, text, status };
  }

  return { indent, type: 'sub', subText: body.trim() };
}

function parseEvidenceSub(text: string): Evidence | null {
  // 新格式：[標題](連結) 內容說明
  const link = text.match(/^\[([^\]]+)\]\(([^)]*)\)\s*(.*)$/);
  if (link) {
    const label = link[1].trim();
    const value = link[2].trim();
    const annotation = link[3].trim() || undefined;
    const type: Evidence['type'] =
      value && (isLinkable(value) || /^https?:\/\//.test(value))
        ? 'citation'
        : 'dataset';
    return { id: uid(), type, label, value, annotation };
  }

  // 舊格式：[標題] 內容說明 https://...
  const bracket = text.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!bracket) return null;

  const label = bracket[1].trim();
  let rest = bracket[2].trim();
  const urlMatch = rest.match(/(https?:\/\/\S+)\s*$/);
  let value = '';
  let annotation = rest;

  if (urlMatch) {
    value = urlMatch[1];
    annotation = rest.slice(0, rest.length - urlMatch[0].length).trim();
  }

  const type: Evidence['type'] =
    /^https?:\/\//.test(value) || /^10\.\d{4,}\//.test(value) ? 'citation' : 'dataset';

  return {
    id: uid(),
    type,
    label,
    value,
    annotation: annotation || undefined,
  };
}

function parseSubItem(text: string): {
  kind: 'note' | 'progress' | 'evidence';
  note?: string;
  progress?: number;
  evidence?: Evidence;
} {
  const progressMatch = text.match(/^實驗進度\s*[:：]\s*(\d+)\s*%?$/);
  if (progressMatch) {
    return { kind: 'progress', progress: Number(progressMatch[1]) };
  }

  const evidence = parseEvidenceSub(text);
  if (evidence) return { kind: 'evidence', evidence };

  return { kind: 'note', note: text };
}

/** 將 Markdown 任務列表解析回節點樹 */
export function importMarkdown(md: string): ResearchNode[] {
  const lines = md.split('\n');
  const nodes: ResearchNode[] = [];
  const stack: { indent: number; id: string }[] = [];
  let lastTask: ResearchNode | null = null;

  for (const raw of lines) {
    if (!raw.trim()) continue;
    const parsed = parseLine(raw);
    if (!parsed) continue;

    if (parsed.type === 'task') {
      while (stack.length && stack[stack.length - 1].indent >= parsed.indent) {
        stack.pop();
      }
      const parentId = stack.length ? stack[stack.length - 1].id : null;
      const node: ResearchNode = {
        id: uid(),
        title: parsed.text ?? '未命名',
        status: parsed.status ?? 'hypothesis',
        evidence: [],
        parentId,
        position: { x: 0, y: 0 },
      };
      nodes.push(node);
      stack.push({ indent: parsed.indent, id: node.id });
      lastTask = node;
    } else if (parsed.type === 'sub' && lastTask && parsed.subText) {
      const result = parseSubItem(parsed.subText);
      if (result.kind === 'progress') lastTask.progress = result.progress;
      else if (result.kind === 'note') {
        lastTask.note = lastTask.note
          ? `${lastTask.note}\n${result.note}`
          : result.note;
      } else if (result.evidence) lastTask.evidence.push(result.evidence);
    }
  }

  return nodes;
}

/** 舊版資料遷移：conflicting → experimenting，confidence → progress */
export function migrateNode(node: ResearchNode): ResearchNode {
  const raw = node as ResearchNode & { confidence?: number };
  const statusRaw = raw.status as string;
  const status: NodeStatus =
    statusRaw === 'conflicting' ? 'experimenting' : (raw.status as NodeStatus);

  const { confidence, ...rest } = raw;
  return {
    ...rest,
    status,
    progress: rest.progress ?? confidence,
  };
}
