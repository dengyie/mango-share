# Little Lighthouse（blog/）

mango 的技术笔记 + 开源项目展示，作为 mangoshare 的子栏目发布在 **<https://share.mangoqwq.com/blog/>**。

基于 [Astro](https://astro.build) 构建的纯静态站。本目录有独立的 `package.json` / `tsconfig.json`，构建与发布由仓库根部的 `.github/workflows/deploy.yml` 统一完成（SPA 与 blog 双构建、双 rsync）。旧域名 `blog.mangoqwq.com` 由 Cloudflare Redirect Rule 全站 301 到新地址。

> 前身是独立仓库 `dengyie/dengyie.github.io`（GitHub Pages），2026-11-15 迁入本仓库，该仓库已停止部署、仅存档。

## 写一篇文章

```bash
cd blog
npm run new      # 交互式向导，生成标准 frontmatter
npm run posts    # 查看全部文章清单（状态/日期/标签）
npm run dev      # 本地预览 http://localhost:4321/blog/
```

文章文件在 `src/content/posts/<slug>.md`，正文从 `##` 开始。写 `draft: true` 可暂存草稿，构建时自动排除。

## 发布

push 到 mangoshare `main` 即上线（约 2 分钟：SPA + blog 构建 → rsync → nginx reload）。CI 门禁含 `npm run check`（astro check）、`npm test`（vitest 20 项）、`npm run build`。

## 注意事项（子路径托管）

- 站点托管在 `/blog/` 子路径：所有内部链接必须经 `src/lib/base.ts` 的 `withBase()` 加前缀，**不要在组件里写 `href="/posts/"` 这类根绝对路径**。
- canonical / RSS / sitemap 由 `astro.config.mjs` 的 `site` + `base` 派生，改域名时两处同步。
- 新文章里引用图片用 `/blog/images/<file>` 绝对路径（图片放 `public/images/`）。

## 改配置

站名、自我介绍、打字文案、方向卡片、项目分类、技能、首页精选项目都在 `src/site.config.ts`。

完整的设计与约定见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。
