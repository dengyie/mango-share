# Little Lighthouse

mango 的个人网站：技术笔记 + 开源项目。线上地址：<https://blog.mangoqwq.com>

基于 [Astro](https://astro.build) 构建，push 到 `main` 后由 GitHub Actions 自动发布到 GitHub Pages。

## 写一篇文章

在 `src/content/posts/` 下新建 `<slug>.md`：

```md
---
title: 文章标题
date: 2026-10-05
tags: [java, notes]
description: 一句话摘要（可选）
---

正文从 ## 开始……
```

然后 `git push`，大约 1 分钟后上线。写 `draft: true` 可以先提交草稿、暂不发布。

## 本地开发

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # 输出到 dist/
```

## 改配置

站名、自我介绍、打字文案、方向卡片、项目分类、技能、首页精选项目都在 `src/site.config.ts`。

完整的设计与约定见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。