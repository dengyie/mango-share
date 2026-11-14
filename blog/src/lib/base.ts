/**
 * 站点托管在 /blog/ 子路径下，所有内部链接必须经 withBase() 加前缀，
 * 否则在 share.mangoqwq.com 上会 404。BASE 由 astro.config.mjs 的 base 派生。
 */
export const BASE = import.meta.env.BASE_URL;

export function withBase(path: string): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith('#')) return path;
  return `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
}
