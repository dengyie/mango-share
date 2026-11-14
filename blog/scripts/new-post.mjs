#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const POSTS_DIR = resolve('src/content/posts');

async function getExistingTags() {
  const tags = new Set();
  try {
    const files = await readdir(POSTS_DIR);
    for (const file of files) {
      if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
      const content = await readFile(join(POSTS_DIR, file), 'utf-8');
      const match = content.match(/^tags:\s*\[(.*?)\]/m);
      if (match) {
        match[1]
          .split(',')
          .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean)
          .forEach((t) => tags.add(t));
      }
    }
  } catch {}
  return [...tags].sort();
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s\t\n]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5\-]+/g, '')
    .replace(/\-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  const args = process.argv.slice(2);
  const rl = createInterface({ input, output });

  try {
    console.log('\n📝 Little Lighthouse · 新建文章向导\n');

    let title = args[0];
    if (!title) {
      title = await rl.question('? 文章标题: ');
    }
    title = title.trim();
    if (!title) {
      console.error('❌ 标题不能为空');
      process.exit(1);
    }

    let defaultSlug = slugify(title);
    let slug = args[1];
    if (!slug) {
      const slugInput = await rl.question(`? 文章 slug (默认: ${defaultSlug}): `);
      slug = slugInput.trim() || defaultSlug;
    }
    slug = slugify(slug);
    if (!slug) {
      slug = `post-${Date.now()}`;
    }

    const filePath = join(POSTS_DIR, `${slug}.md`);
    if (existsSync(filePath)) {
      console.error(`❌ 文件已存在: ${filePath}`);
      process.exit(1);
    }

    const description = (await rl.question('? 文章描述 / 摘要 (可选): ')).trim();

    const existingTags = await getExistingTags();
    if (existingTags.length > 0) {
      console.log(`💡 常用标签参考: ${existingTags.slice(0, 12).join(', ')}...`);
    }
    const tagsInput = (await rl.question('? 标签 (用逗号分隔，如 ai, automation): ')).trim();
    const tags = tagsInput
      ? tagsInput.split(/[,，]/).map((t) => t.trim().toLowerCase()).filter(Boolean)
      : [];

    const draftInput = (await rl.question('? 是否设为草稿? (y/N): ')).trim().toLowerCase();
    const draft = draftInput === 'y' || draftInput === 'yes';

    const today = new Date().toISOString().slice(0, 10);

    const frontmatter = [
      '---',
      `title: ${JSON.stringify(title)}`,
      `date: ${today}`,
      description ? `description: ${JSON.stringify(description)}` : null,
      `tags: [${tags.map((t) => JSON.stringify(t)).join(', ')}]`,
      draft ? 'draft: true' : null,
      '---',
      '',
      '## 一级小结或引言',
      '',
      '在这里开始撰写你的文章正文。标题请从二级标题 `##` 开始（布局组件已自动输出文章的大标题）。',
      '',
    ]
      .filter((line) => line !== null)
      .join('\n');

    await writeFile(filePath, frontmatter, 'utf-8');

    console.log(`\n✅ 文章创建成功！`);
    console.log(`📄 文件路径: ${filePath}`);
    console.log(`🌐 预期访问 URL: /posts/${slug}/`);
    console.log(`\n接下来可以运行 npm run dev 在本地预览编写效果。\n`);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('创建失败:', err);
  process.exit(1);
});
