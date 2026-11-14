import { describe, it, expect, vi } from 'vitest';

// 为 astro:content 虚拟模块提供测试桩
vi.mock('astro:content', () => ({
  getCollection: vi.fn(),
}));

import {
  stripMarkdown,
  formatDate,
  tagsOf,
  getAllTags,
  adjacent,
  relatedPosts,
  readingMinutes,
  summary,
  type Post,
} from '../src/lib/posts';

describe('posts lib', () => {
  describe('stripMarkdown', () => {
    it('strips code blocks, links, formatting, and headers', () => {
      const input = `
# 标题一
这是一段**加粗**和*斜体*文本，带有一个[超链接](https://example.com)。
\`\`\`js
console.log('hello');
\`\`\`
行内代码 \`const x = 1;\` 和图片 ![说明](/img.png)
- 列表项 1
- 列表项 2
> 引用文本
<div class="test">HTML内容</div>
`;
      const cleaned = stripMarkdown(input);
      expect(cleaned).not.toContain('# 标题一');
      expect(cleaned).not.toContain('console.log');
      expect(cleaned).not.toContain('https://example.com');
      expect(cleaned).toContain('超链接');
      expect(cleaned).toContain('这是一段加粗和斜体文本');
      expect(cleaned).toContain('HTML内容');
      expect(cleaned).not.toContain('const x = 1;');
    });

    it('preserves snake_case identifiers and handles tables without word collision', () => {
      const input = `
| 参数名 | 类型 | 说明 |
| :--- | :--- | :--- |
| user_id | string | 唯一标识符 |
| api_key | string | 密钥 |

使用 CF_API_KEY 配置环境变量。
`;
      const cleaned = stripMarkdown(input);
      expect(cleaned).toContain('CF_API_KEY');
      expect(cleaned).toContain('user_id');
      expect(cleaned).toContain('api_key');
      expect(cleaned).toContain('参数名 类型 说明');
      expect(cleaned).not.toContain('|');
    });
  });

  describe('formatDate', () => {
    it('formats date in UTC YYYY-MM-DD', () => {
      const d = new Date('2026-10-17T00:00:00Z');
      expect(formatDate(d)).toBe('2026-10-17');
    });
  });

  describe('tagsOf', () => {
    it('normalizes, deduplicates, and lowercases tags', () => {
      const post = {
        data: {
          tags: [' Android ', 'android', 'AI', '  ', 'CPP'],
        },
      } as unknown as Post;
      expect(tagsOf(post)).toEqual(['android', 'ai', 'cpp']);
    });
  });

  describe('getAllTags', () => {
    it('aggregates tags, sorting by count descending then alphabetically', () => {
      const p1 = { data: { tags: ['ai', 'agent'] } } as unknown as Post;
      const p2 = { data: { tags: ['ai', 'tool'] } } as unknown as Post;
      const p3 = { data: { tags: ['agent'] } } as unknown as Post;
      const tags = getAllTags([p1, p2, p3]);
      expect(tags).toEqual([
        ['agent', 2],
        ['ai', 2],
        ['tool', 1],
      ]);
    });
  });

  describe('adjacent', () => {
    const p1 = { id: 'post-1', data: { date: new Date('2026-10-03') } } as unknown as Post;
    const p2 = { id: 'post-2', data: { date: new Date('2026-10-02') } } as unknown as Post;
    const p3 = { id: 'post-3', data: { date: new Date('2026-10-01') } } as unknown as Post;
    const posts = [p1, p2, p3]; // 降序

    it('returns correct prev and next for middle post', () => {
      const result = adjacent(p2, posts);
      expect(result.prev?.id).toBe('post-3'); // 更早一篇
      expect(result.next?.id).toBe('post-1'); // 更新一篇
    });

    it('returns undefined next for newest post', () => {
      const result = adjacent(p1, posts);
      expect(result.next).toBeUndefined();
      expect(result.prev?.id).toBe('post-2');
    });

    it('returns undefined prev for oldest post', () => {
      const result = adjacent(p3, posts);
      expect(result.prev).toBeUndefined();
      expect(result.next?.id).toBe('post-2');
    });

    it('safely handles post not in the list without off-by-one error', () => {
      const missing = { id: 'post-missing' } as unknown as Post;
      const result = adjacent(missing, posts);
      expect(result.prev).toBeUndefined();
      expect(result.next).toBeUndefined();
    });
  });

  describe('relatedPosts', () => {
    const target = { id: 'target', data: { tags: ['ai', 'tool'], date: new Date('2026-10-01') } } as unknown as Post;
    const pBoth = { id: 'both', data: { tags: ['ai', 'tool'], date: new Date('2026-10-02') } } as unknown as Post;
    const pOneOld = { id: 'one-old', data: { tags: ['ai'], date: new Date('2026-09-01') } } as unknown as Post;
    const pOneNew = { id: 'one-new', data: { tags: ['ai'], date: new Date('2026-09-10') } } as unknown as Post;
    const pNone = { id: 'none', data: { tags: ['cpp'], date: new Date('2026-10-03') } } as unknown as Post;

    it('ranks by common tag count and then by date, excluding self and unrelated', () => {
      const related = relatedPosts(target, [target, pBoth, pOneOld, pOneNew, pNone]);
      expect(related.map((p) => p.id)).toEqual(['both', 'one-new', 'one-old']);
    });
  });

  describe('readingMinutes', () => {
    it('calculates minimum 1 minute for short content', () => {
      const post = { body: '短文' } as unknown as Post;
      expect(readingMinutes(post)).toBe(1);
    });

    it('calculates proportional reading time for longer text', () => {
      const cjkText = '这是一段测试汉字。'.repeat(100); // 900字左右
      const post = { body: cjkText } as unknown as Post;
      expect(readingMinutes(post)).toBeGreaterThanOrEqual(2);
    });
  });

  describe('summary', () => {
    it('prioritizes description over excerpt and body', () => {
      const post = {
        data: { description: '指定摘要', excerpt: '兼容摘要' },
        body: '这是很长的正文内容',
      } as unknown as Post;
      expect(summary(post)).toBe('指定摘要');
    });

    it('truncates body when description is missing', () => {
      const post = {
        data: {},
        body: 'a'.repeat(200),
      } as unknown as Post;
      const res = summary(post, 50);
      expect(res.endsWith('…')).toBe(true);
      expect(res.length).toBe(51); // 50 chars + ellipsis
    });

    it('safely handles Unicode surrogates (emojis) at truncation boundary', () => {
      const base = '这是一段用来测试截断边界的普通中文文本内容，长度刚好凑齐四十九个字啦！';
      const postWithEmoji = {
        data: {},
        body: `${base}🤖${'额外内容'.repeat(10)}`,
      } as unknown as Post;
      const res = summary(postWithEmoji, 50);
      expect(res.endsWith('…')).toBe(true);
      expect(res).toContain('🤖');
      expect(Array.from(res).length).toBe(51); // 50 code points + ellipsis
    });
  });
});
