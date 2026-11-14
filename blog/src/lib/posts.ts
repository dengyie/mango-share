import { getCollection, type CollectionEntry } from 'astro:content';
import { withBase } from './base';

export type Post = CollectionEntry<'posts'>;

/** 已发布文章，按日期从新到旧。开发模式下包含草稿。 */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf() || a.id.localeCompare(b.id));
}

export const postUrl = (post: Post) => withBase(`/posts/${post.id}/`);
export const tagUrl = (tag: string) => withBase(`/tags/${tag}/`);

export function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 去掉 Markdown 标记，用于摘要和字数统计（代码块不计入）。 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/[*~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function summary(post: Post, max = 120): string {
  const given = post.data.description ?? post.data.excerpt;
  if (given) return given;
  const text = stripMarkdown(post.body ?? '');
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : text;
}

/** 中文 400 字/分钟，英文 200 词/分钟，最少 1 分钟。 */
export function readingMinutes(post: Post): number {
  const text = stripMarkdown(post.body ?? '');
  const cjk = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  const words = (text.replace(/[\u3400-\u9fff]/g, ' ').match(/[A-Za-z0-9_]+/g) ?? []).length;
  return Math.max(1, Math.round(cjk / 400 + words / 200));
}

export function tagsOf(post: Post): string[] {
  return [...new Set(post.data.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

/** 全部标签及文章数，按数量降序。 */
export function getAllTags(posts: Post[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const post of posts) for (const tag of tagsOf(post)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** 共同标签越多越相关，相同时取较新的；没有共同标签不算相关。 */
export function relatedPosts(post: Post, posts: Post[], limit = 3): Post[] {
  const tags = new Set(tagsOf(post));
  return posts
    .filter((p) => p.id !== post.id)
    .map((p) => ({ p, score: tagsOf(p).filter((t) => tags.has(t)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.p.data.date.valueOf() - a.p.data.date.valueOf())
    .slice(0, limit)
    .map((x) => x.p);
}

/** posts 需按日期从新到旧排列。prev 是更早的一篇，next 是更新的一篇。未找到时返回空对象。 */
export function adjacent(post: Post, posts: Post[]): { prev?: Post; next?: Post } {
  const i = posts.findIndex((p) => p.id === post.id);
  if (i === -1) return { prev: undefined, next: undefined };
  return { prev: posts[i + 1], next: i > 0 ? posts[i - 1] : undefined };
}