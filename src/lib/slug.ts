/** 依研究名稱產生 URL slug（保留中文，空白轉連字號） */
export function slugify(name: string): string {
  let slug = name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf-]/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  if (!slug) slug = `research-${Date.now()}`;
  return slug;
}

export function ensureUniqueSlug(base: string, existing: Set<string>): string {
  let slug = slugify(base);
  if (!existing.has(slug)) return slug;
  let n = 2;
  while (existing.has(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}

/** 研究頁面路徑 */
export function researchPath(slug: string): string {
  return `/r/${encodeURIComponent(slug)}`;
}

/** 從 pathname 解析 slug，例如 /r/my-research */
export function parseResearchSlug(pathname: string): string | null {
  const m = pathname.match(/^\/r\/([^/]+)$/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}
