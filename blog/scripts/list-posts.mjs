#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const POSTS_DIR = resolve('src/content/posts');

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const lines = match[1].split('\n');
  const data = {};
  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    let val = line.slice(colon + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.slice(1, -1);
    } else if (val.startsWith('[') && val.endsWith(']')) {
      val = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else if (val === 'true') {
      val = true;
    } else if (val === 'false') {
      val = false;
    }
    data[key] = val;
  }
  return data;
}

async function main() {
  const files = await readdir(POSTS_DIR);
  const posts = [];

  for (const file of files) {
    if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
    const fullPath = join(POSTS_DIR, file);
    const content = await readFile(fullPath, 'utf-8');
    const fm = parseFrontmatter(content);
    const slug = file.replace(/\.mdx?$/, '');
    posts.push({
      slug,
      file,
      title: fm.title || slug,
      date: fm.date || '无日期',
      draft: Boolean(fm.draft),
      tags: Array.isArray(fm.tags) ? fm.tags : [],
      words: content.length,
    });
  }

  posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  console.log(`\n📚 Little Lighthouse · 文章列表 (共 ${posts.length} 篇)\n`);
  console.log(
    '状态\t日期\t\tSlug\t\t\t\t标题\t\t\t标签'
  );
  console.log('-'.repeat(90));

  for (const p of posts) {
    const status = p.draft ? '🟡 草稿' : '🟢 线上';
    const slugPad = p.slug.length < 24 ? p.slug.padEnd(24) : p.slug.slice(0, 21) + '...';
    const titlePad = p.title.length < 18 ? p.title.padEnd(18) : p.title.slice(0, 15) + '...';
    const tags = p.tags.join(', ');
    console.log(`${status}\t${p.date}\t${slugPad}\t${titlePad}\t[${tags}]`);
  }

  console.log('\n💡 提示:');
  console.log(' - 新增文章: npm run new');
  console.log(' - 编辑文章: 直接修改 src/content/posts/<slug>.md');
  console.log(' - 暂存草稿: frontmatter 中添加 draft: true');
  console.log(' - 删除/下线: 删除对应 .md 文件，并在 git 中提交\n');
}

main().catch(console.error);
