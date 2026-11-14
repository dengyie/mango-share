import { SITE } from '../site.config';

export interface Repo {
  name: string;
  description: string | null;
  url: string;
  language: string | null;
  stars: number;
  topics: string[];
  pushedAt: string;
  /** 分类 id，见 site.config.ts 的 categories；匹配不到为 'other' */
  category: string;
}

export interface Category {
  id: string;
  label: string;
  count: number;
}

export interface Stats {
  repos: number;
  stars: number;
  /** GitHub 账号年限，拉取失败时为 null */
  years: number | null;
}

const OTHER = { id: 'other', label: '其他' };

let repoCache: Promise<Repo[]> | undefined;
let userCache: Promise<{ createdAt: string } | null> | undefined;

/** 构建时拉取原创仓库，同一次构建只请求一次。规则见 docs/DEVELOPMENT.md 第 9 节。 */
export function getRepos(): Promise<Repo[]> {
  repoCache ??= fetchRepos();
  return repoCache;
}

export async function getFeaturedRepos(): Promise<Repo[]> {
  const repos = await getRepos();
  return SITE.featuredProjects
    .map((name) => repos.find((r) => r.name === name))
    .filter((r): r is Repo => Boolean(r));
}

/** 项目页的分类 tab：按配置顺序，「其他」放最后，空分类不显示。 */
export async function getCategories(): Promise<Category[]> {
  const repos = await getRepos();
  return [...SITE.categories, OTHER]
    .map((c) => ({ id: c.id, label: c.label, count: repos.filter((r) => r.category === c.id).length }))
    .filter((c) => c.count > 0);
}

export function calculateAccountYears(createdAt: string, now = new Date()): number {
  const created = new Date(createdAt);
  let years = now.getUTCFullYear() - created.getUTCFullYear();
  const isBeforeAnniversary =
    now.getUTCMonth() < created.getUTCMonth() ||
    (now.getUTCMonth() === created.getUTCMonth() && now.getUTCDate() < created.getUTCDate());
  if (isBeforeAnniversary) {
    years--;
  }
  return Math.max(0, years);
}

/** 首页数据条，全部在构建时算出，不用手改。 */
export async function getStats(): Promise<Stats> {
  const [repos, user] = await Promise.all([getRepos(), getUser()]);
  return {
    repos: repos.length,
    stars: repos.reduce((sum, r) => sum + r.stars, 0),
    years: user ? calculateAccountYears(user.createdAt) : null,
  };
}

/** 先按仓库名，再按 topics 归类（大小写均不敏感）。 */
export function categorize(name: string, topics: string[]): string {
  const lower = name.toLowerCase();
  const byName = SITE.categories.find((c) => c.repos.some((r) => r.toLowerCase() === lower));
  if (byName) return byName.id;
  const topicSet = new Set(topics.map((t) => t.trim().toLowerCase()));
  const byTopic = SITE.categories.find((c) => c.topics.some((t) => topicSet.has(t.trim().toLowerCase())));
  return byTopic?.id ?? OTHER.id;
}

async function request<T>(path: string, fallback: T, timeoutMs = 10_000): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'little-lighthouse',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status} ${path}: ${await res.text()}`);
    return (await res.json()) as T;
  } catch (err) {
    // CI 中直接失败，避免把空的项目页发布上线
    if (process.env.CI) throw err;
    console.warn('[github] 请求失败，使用空数据：', err);
    return fallback;
  }
}

async function fetchRepos(): Promise<Repo[]> {
  const data = await request<any[]>(`/users/${SITE.github}/repos?per_page=100&type=owner&sort=pushed`, []);
  if (data.length === 100) {
    console.warn('[github] 仓库数量达到单页上限 100，建议配置分页以避免后续仓库被截断');
  }
  return data
    .filter((r) => !r.fork && !r.archived && !r.private && !SITE.hiddenProjects.includes(r.name))
    .map((r) => {
      const topics: string[] = r.topics ?? [];
      return {
        name: r.name,
        description: r.description,
        url: r.html_url,
        language: r.language,
        stars: r.stargazers_count ?? 0,
        topics,
        pushedAt: r.pushed_at ?? '',
        category: categorize(r.name, topics),
      };
    })
    .sort((a, b) => b.stars - a.stars || b.pushedAt.localeCompare(a.pushedAt));
}

function getUser(): Promise<{ createdAt: string } | null> {
  userCache ??= request<any>(`/users/${SITE.github}`, null).then((u) =>
    u?.created_at ? { createdAt: u.created_at as string } : null,
  );
  return userCache;
}