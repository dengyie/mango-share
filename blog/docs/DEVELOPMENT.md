# Little Lighthouse 开发文档

> 本文档记录 Astro 重构版的设计决策、约定和日常维护方式。当前为 **v3**：v1 个人主页的视觉（暗色 + 芒果橙、头像、终端打字、数据条、方向卡片、项目筛选）+ v2 的内容骨架（一篇文章一个 md、标签、RSS）。代码中出现的「见第 N 节」都指本文档。
> 旧版（Next.js + Folk Canvas）已完整存档在 tag `legacy/folk-canvas`，需要时用 `git checkout legacy/folk-canvas` 找回。

---

## 1. 目标与原则

**一句话目标：一篇文章就是一个 Markdown 文件，push 之后自动上线。**

旧版的问题不在功能多，而在同一篇文章有三份数据（`.md` frontmatter、`.meta.json`、`folkShowcase.json`）。为了让三份数据对得上，又叠了一层 resolve / validate / warnings / bridge 代码，以及 4 个保真校验脚本。结果是加一篇文章要改多处，详情页甚至会渲染 showcase 里的占位内容，而不是原文。

v2 遵循四条原则，后续改动也应遵守：

| 原则 | 含义 | 反例（不要这样做） |
| --- | --- | --- |
| **单一数据源** | 文章的所有信息只写在自己的 frontmatter 里 | 再加一个全局 JSON 存"精选""展示标题" |
| **约定优于配置** | 文件名即 slug；排序、阅读时长、摘要、相关文章全部自动计算 | 手写 `relatedPosts`、`readingTime` |
| **能删就删** | 不为假想需求留代码；过程文档不进主分支 | 保留"以后可能用到"的组件 |
| **写作零摩擦** | 新文章 = 新建 md + `git push`，不需要跑任何脚本 | 发布前必须执行 verify 脚本 |

判断一个新需求要不要做，先问：它会不会让"写一篇文章"多一个步骤？会的话，换一种做法。

---

## 2. 技术栈

| 选择 | 理由 |
| --- | --- |
| **Astro 7** | 专为内容站设计；Markdown 是一等公民；默认产物为纯 HTML，不带 JS 运行时 |
| `astro:content` + zod | frontmatter 写错（缺 title、日期格式错）时构建直接报错，取代旧版的 validate 层 |
| Shiki（Astro 内置） | 构建时完成代码高亮，支持明暗双主题，不需要 `rehype-highlight` |
| `@astrojs/rss` / `@astrojs/sitemap` | 官方插件，取代旧版的 `generate-static-meta.mjs` |
| 单个 `global.css` | 站点只有约 10 种元素，CSS Modules 和 Tailwind 都是负担 |
| 系统字体栈 | 不依赖 Google Fonts，国内访问稳定，无字体闪烁 |

**依赖只有 3 个**：`astro`、`@astrojs/rss`、`@astrojs/sitemap`。新增依赖前请确认它不能用十几行代码替代。

**运行时 JS 只有三处，全部内联、全部是渐进增强**：

| 位置 | 作用 | 关掉 JS 时 |
| --- | --- | --- |
| `Base.astro` + `ThemeToggle` | 主题初始化与切换 | 固定暗色 |
| `Hero.astro` | 终端打字效果 | 显示第一句，不动 |
| `projects.astro` | 分类 tab + 搜索 | 筛选栏隐藏，直接显示全部项目 |

构建产物 `dist/` 中没有任何 `.js` 文件，也不引入任何前端框架，这是一条要守住的线。新增交互前先确认：没有 JS 时页面依然完整可用。

---

## 3. 目录结构

```
.
├── .github/workflows/deploy.yml   # 构建并发布到 GitHub Pages（第 10 节）
├── astro.config.mjs               # 站点 URL、sitemap、代码高亮、旧链接重定向
├── docs/DEVELOPMENT.md            # 本文档
├── public/                        # 原样复制到站点根目录
│   ├── icon.svg
│   ├── robots.txt
│   └── images/                    # 文章引用的图片（第 4.3 节）
└── src/
    ├── site.config.ts             # ★ 站名、自我介绍、打字文案、方向卡片、项目分类、技能、精选项目
    ├── content.config.ts          # 文章 frontmatter schema（第 4 节）
    ├── content/posts/*.md         # ★ 文章，一篇一个文件
    ├── lib/
    │   ├── posts.ts               # 文章查询与派生字段（第 6 节）
    │   └── github.ts              # 构建时拉取 GitHub 仓库（第 9 节）
    ├── layouts/
    │   ├── Base.astro             # HTML 骨架、SEO、主题初始化、Header/Footer
    │   ├── Post.astro             # 文章页：元信息、目录、上下篇、相关文章
    │   └── Page.astro             # 新增 Markdown 单页时使用（第 12.4 节）
    ├── components/                # 8 个小组件（第 7 节）
    ├── pages/                     # 文件即路由（第 5 节）
    └── styles/global.css          # 唯一的样式文件（第 8 节）
```

标 ★ 的两处是日常唯一需要碰的地方。

---

## 4. 内容模型

### 4.1 Frontmatter

```md
---
title: RecyclerView 缓存策略详解          # 必填
date: 2024-12-20                          # 必填，YYYY-MM-DD
updated: 2025-01-03                       # 可选，显示"更新于"
description: 一句话摘要                    # 可选，见 4.2
tags: [android, performance]              # 可选，默认 []
draft: true                               # 可选，默认 false
---

正文从 `##` 开始。
```

schema 定义在 `src/content.config.ts`。规则：

- **slug = 文件名**。`java-stack-heap.md` → `/posts/java-stack-heap/`。用小写字母、数字和连字符；发布后不要改名，否则旧链接失效（真要改，在 `astro.config.mjs` 的 `redirects` 里加一条）。
- **不要在正文里写 `# 标题`**。标题由布局根据 `title` 渲染，正文写一级标题会出现两个 h1。
- **未知字段会被静默忽略**，不会报错。所以旧格式的 `category`、`featured` 等字段留着也无害，但请不要依赖它们。
- `excerpt` 是 `description` 的兼容别名，只为接住自动生成的日报（第 12.3 节），手写文章请用 `description`。

### 4.2 自动计算的字段

| 字段 | 规则 | 实现 |
| --- | --- | --- |
| 摘要 | `description` → `excerpt` → 正文去掉 Markdown 后取前 120 字 | `summary()` |
| 阅读时长 | 中文 400 字/分钟 + 英文 200 词/分钟，代码块不计，最少 1 分钟 | `readingMinutes()` |
| 排序 | 日期降序，同日按 slug 升序 | `getPosts()` |
| 相关文章 | 共同标签数降序，再按日期；没有共同标签不展示；最多 3 篇 | `relatedPosts()` |
| 上一篇 / 下一篇 | 按日期相邻的文章；"上一篇"是更早的那篇 | `adjacent()` |
| 目录 | 文章有 3 个及以上 h2/h3 时显示 | `Post.astro` |

### 4.3 标签

- 标签取代了旧版的"分类"。一篇文章可以有多个标签，不需要映射表。
- 全部转为小写并去重。`C++` 这类含特殊字符的写成 `cpp`。
- 中文标签可以用（如 `日报`），URL 为 `/tags/日报/`。
- 标签页按文章数量排序；只出现一次的标签也会生成页面。

### 4.4 图片

当前做法：图片放 `public/images/`，正文用绝对路径引用：

```md
![AI 日报海报](/images/ai-daily-2026-08-14.png)
```

命名建议用 `<slug>.png` 或 `<slug>-<序号>.png`，方便对应文章。单张图建议压到 500KB 以内（`ai-daily-2026-08-14.png` 有 1MB，后续可以压缩）。

> 进阶：Astro 也支持把图片放在 md 同目录、用相对路径 `./cover.png` 引用，构建时会自动压缩并生成 webp。目前没启用，是为了让自动发布脚本可以继续往 `public/images/` 写图。图片多了以后可以考虑切换。

### 4.5 草稿

`draft: true` 的文章在 `npm run dev` 下可见，构建时排除，也不会出现在 RSS 和 sitemap 中。

---

## 5. 路由

| 路由 | 文件 | 内容 |
| --- | --- | --- |
| `/` | `pages/index.astro` | Hero（头像、打字、数据条）→ 我在折腾什么 → 精选项目 → 最新 5 篇 → 一起折腾 |
| `/posts/` | `pages/posts/index.astro` | 全部文章，按年份分组 |
| `/posts/<slug>/` | `pages/posts/[slug].astro` | 文章详情 |
| `/tags/` | `pages/tags/index.astro` | 全部标签及数量 |
| `/tags/<tag>/` | `pages/tags/[tag].astro` | 某标签下的文章 |
| `/projects/` | `pages/projects.astro` | GitHub 原创仓库，支持 `?cat=ai&q=proxy` 直达筛选结果 |
| `/about/` | `pages/about.astro` | 关于我、方向卡片、技能墙（`#skills`），文案来自 `site.config.ts` |
| `/rss.xml` | `pages/rss.xml.ts` | RSS 订阅 |
| `/feed.xml` | `pages/feed.xml.ts` | `/rss.xml` 的别名，兼容旧订阅 |
| `/sitemap-index.xml` | sitemap 插件 | 自动生成 |
| `/404.html` | `pages/404.astro` | GitHub Pages 自动使用 |

### 旧链接兼容

旧版的这些地址在 `astro.config.mjs` 的 `redirects` 中跳转到新地址，避免搜索引擎和外链出现 404：

| 旧地址 | 新地址 |
| --- | --- |
| `/categories/java` | `/tags/java/` |
| `/categories/android` | `/tags/android/` |
| `/categories/cpp` | `/tags/cpp/` |
| `/categories/other` | `/tags/` |
| `/submit` | `/` |
| `/feed.xml` | 保留为 RSS 别名 |

文章地址 `/posts/<slug>` 保持不变（GitHub Pages 会自动补上结尾的 `/`）。

---

## 6. 数据流

```
src/content/posts/*.md
        │  glob loader + zod schema（content.config.ts）
        ▼
getCollection('posts')         ← 构建时一次性读取
        │  lib/posts.ts：过滤草稿、排序、派生字段
        ▼
pages/*.astro                  ← 每个页面只调用 lib 里的函数
        │
        ▼
dist/*.html                    ← 纯静态 HTML
```

约定：

- **页面不直接调用 `getCollection`**，一律经过 `lib/posts.ts` 的 `getPosts()`，保证草稿过滤和排序规则只有一处。
- **派生字段是纯函数**（输入文章，输出值），不缓存、不写回文件。
- `lib/` 中不出现 HTML 和样式，组件中不出现业务规则。

---

## 7. 组件与布局

| 组件 | 职责 | 用在 |
| --- | --- | --- |
| `Header` | 站名 + 导航 + 主题切换；根据当前路径高亮 | Base |
| `Footer` | 版权、RSS、GitHub | Base |
| `ThemeToggle` | 切换 `data-theme` 并写入 localStorage | Header |
| `PostList` | 日期 + 标题（+ 可选摘要）的列表 | 首页、归档、标签、相关文章 |
| `TagList` | 标签胶囊（+ 可选数量） | 文章页、标签页 |
| `ProjectCard` | 仓库名、星数、描述、语言、topics；带 `data-cat` / `data-search` 供筛选 | 首页、项目页 |
| `Hero` | 头像、问候、终端打字、按钮、4 个数据卡 | 首页 |
| `Directions` | 「我在折腾什么」方向卡片，自动显示对应分类的项目数 | 首页、关于页 |

新增组件的门槛：**至少被两个页面使用**，否则直接写在页面里。`Hero` 是唯一例外：它自带数据计算和脚本，拆出来能让首页只剩版块编排。

### 主题切换

1. `Base.astro` 的 `<head>` 中有一段内联脚本，在页面渲染前读取 `localStorage.theme`，**没有就用暗色**（站点的默认形象），写到 `<html data-theme>`，避免闪烁。
2. `:root` 就是暗色，亮色全部通过 `[data-theme='light']` 覆盖变量（第 8 节）。
3. 代码块的暗色由 Shiki 双主题变量 `--shiki-dark*` 提供，在 `global.css` 末尾切换。

---

## 8. 视觉设计

方向：**像一个人，而不是一个模板**。界面沿用 v1：深色底、芒果橙渐变强调、头像光圈、终端打字、卡片。阅读部分沿用 v2：窄栏、衬线标题、舒展的行距。也就是说，**首页和项目页是名片，文章页是书**。

### 页面宽度（`Base.astro` 的 `width` 属性）

| 值 | 宽度 | 用在 |
| --- | --- | --- |
| `narrow`（默认） | `--measure` 46rem | 文章、归档、标签、关于 |
| `wide` | `--wide` 72rem | 项目页（卡片网格） |
| `full` | 通栏，内部再套 72rem | 首页（分段背景） |

### Design tokens（`global.css` 顶部）

| Token | 暗色（默认） | 亮色 | 用途 |
| --- | --- | --- | --- |
| `--bg` | `#0b0d10` | `#faf8f4` | 页面背景 |
| `--surface` | `#101318` | `#f3efe7` | 交替分段背景、目录、表头 |
| `--card` | `#161a20` | `#fffdf9` | 卡片、按钮、输入框 |
| `--text` | `#e8ecf1` | `#1f1d1a` | 正文 |
| `--muted` | `#8a94a3` | `#6f695f` | 日期、摘要、次要信息 |
| `--line` | `#232933` | `#e4ddd1` | 分隔线、边框 |
| `--accent` | `#ffb020` | `#c2410c` | 链接、数字、hover（芒果橙） |
| `--grad` | `#ffb020 → #ff7a1a` | `#c2410c → #ea580c` | 主按钮、选中 tab、名字 |
| `--on-accent` | `#1a1204` | `#ffffff` | 渐变上的文字 |
| `--glow` | 橙色 16% | 橙色 10% | Hero 右上角光晕 |

字体：

- `--sans`：界面标题和正文。系统 UI 字体，中文回退到苹方 / 微软雅黑
- `--serif`：**只用于文章标题和文章内小标题**，保留阅读感
- `--mono`：日期、数据、仓库名、标签、代码

规则：

- **改颜色只改 token**，组件样式中不出现色值。唯一例外是 `ProjectCard` 的语言色点。
- 新增颜色前先问：能不能用 `--muted` 或 `--accent` 表达？
- 断点：`560px`（文章列表变单列）和 `640px`（Hero 竖排、数据条 2×2、项目卡片单列）。
- 动效都尊重 `prefers-reduced-motion`：打字和光标闪烁会停下。

---

## 9. 项目页：GitHub 数据

`src/lib/github.ts` 在**构建时**请求：

```
GET https://api.github.com/users/dengyie/repos?per_page=100&type=owner&sort=pushed
```

处理规则：

1. 排除 fork、已归档、私有仓库，以及 `site.config.ts` 中 `hiddenProjects` 列出的仓库
2. 按星数降序，相同时按最近 push 时间
3. 首页只显示 `featuredProjects` 中列出的仓库（当前 6 个），按配置顺序排列
4. 同一次构建只请求一次（模块级 Promise 缓存）

### 分类

项目页的 tab 来自 `site.config.ts` 的 `categories`，每个仓库按以下顺序归类：

1. 仓库名出现在某个分类的 `repos` 中（不区分大小写）→ 归到该类
2. 否则，仓库的 GitHub topics 命中某个分类的 `topics` → 归到第一个命中的类
3. 都没有 → 「其他」

所以**新建仓库时加上合适的 topics，就能自动进对的分类**，不用改配置。没有项目的分类不显示 tab。

### 首页数据条

全部在构建时算出，不需要手改：

| 数据 | 来源 |
| --- | --- |
| 原创开源项目 | 过滤后的仓库数 |
| 获得 Star | 这些仓库的星数之和 |
| 篇技术笔记 | 已发布文章数 |
| 年 GitHub 龄 | `GET /users/dengyie` 的 `created_at`，失败时显示 `—` |

鉴权与失败处理：

- CI 中通过环境变量 `GITHUB_TOKEN` 鉴权（Actions 自带，无需配置），避免匿名请求每小时 60 次的限额
- **CI 中请求失败会让构建失败**，宁可不发布，也不把空的项目页推上线
- 本地请求失败只打印警告，项目页显示"暂时拉取不到"，不影响写文章

数据新鲜度：workflow 每天北京时间 8 点自动重新构建一次，星数和新仓库最多延迟一天。

常见调整：

| 想做的事 | 改哪里 |
| --- | --- |
| 换首页精选 | `site.config.ts` → `featuredProjects` |
| 改分类或新增分类 | `site.config.ts` → `categories` |
| 方向卡片链到别的分类 | `site.config.ts` → `directions[].category` |
| 隐藏某个仓库 | `site.config.ts` → `hiddenProjects` |
| 改项目描述 | 去 GitHub 仓库页改 About，下次构建自动同步 |
| 给项目加标签 | 在 GitHub 仓库上加 topics，卡片会显示前 3 个 |

> 当前不超过 100 个仓库，所以没有处理分页。超过时需要在 `fetchRepos` 中翻页。

---

## 10. 构建与部署

### 本地

```bash
npm install
npm run new       # 交互式向导：新建文章并生成标准 Frontmatter 模板
npm run posts     # 查看全部文章列表、草稿状态、日期、标签与字数
npm run dev       # http://localhost:4321，支持热更新，包含草稿
npm run check     # astro check 类型检查（CI 必过）
npm test          # vitest 单元测试（CI 必过）
npm run build     # 输出到 dist/
npm run preview   # 预览 dist/
```

要求 Node ≥ 22.12。

### CI（`.github/workflows/deploy.yml`）

| 触发 | 说明 |
| --- | --- |
| push 到 `main` | 写完文章 push 即发布 |
| 每天 00:00 UTC | 刷新项目数据 |
| 手动 `workflow_dispatch` | 在 Actions 页面点 Run |

流程：`npm ci` → `npm run check`（类型检查）→ `npm test`（单元测试）→ `npm run build` → 上传 `dist/` → `deploy-pages` 发布。任一检查失败都会中止发布。从 push 到上线约 1 分钟。

GitHub 仓库设置要求：**Settings → Pages → Source 选 "GitHub Actions"**（当前已经是）。构建产物不再提交进仓库。

---

## 11. 分支策略与迁移

### 目标状态

- **只有一个分支 `main`**，存放源码，也是默认分支
- 不再有放构建产物的分支

### 迁移前（2026-10）

| 分支 | 内容 | 处理 |
| --- | --- | --- |
| `master` | 默认分支，Next.js 构建产物 | 删除 |
| `main` | 2026-06 的旧构建产物 | 删除 |
| `source` | Next.js + Folk Canvas 源码，Actions 从这里发布 | 存档为 tag `legacy/folk-canvas`，然后改名为 `main` |

### 迁移步骤

1. 打 tag `legacy/folk-canvas` 存档旧源码并推送 ✅
2. 从 `source` 新建 `rewrite` 分支，用 v2 替换全部内容 ✅
3. 提 PR：`rewrite` → `source`，在 PR 中审阅改动
4. 合并。新 workflow 只监听 `main`，所以合并到 `source` **不会触发发布**，线上仍是旧版
5. 删除旧的 `main` 分支，把 `source` 改名为 `main`，设为默认分支
6. 检查 **Settings → Environments → github-pages** 的部署分支限制，允许 `main`
7. 在 Actions 手动运行一次 workflow，确认线上已切换到新版
8. 删除 `master`

第 4 步之前随时可以放弃，线上不受影响；第 7 步之后如需回滚，见 12.5。

---

## 12. 常见任务

### 12.1 文章日常管理（新建、编辑、删除与整理）

#### A. 新建文章
推荐使用内置向导，自动生成标准 Frontmatter 并校验文件名：
```bash
# 交互式向导（会提示标题、Slug、摘要、常用标签与是否草稿）
npm run new

# 或者直接传入标题与指定 slug
npm run new "我的新文章标题" my-custom-slug
```
生成的文章存放在 `src/content/posts/<slug>.md`。

#### B. 查看当前文章列表
```bash
npm run posts
```
可一目了然查看所有文章的线上/草稿状态、日期、slug、标题和标签。

#### C. 编辑与修改文章
- 直接编辑 `src/content/posts/<slug>.md`。
- 如果文章有大幅修改，可在 frontmatter 中添加 `updated: YYYY-MM-DD` 记录更新时间。
- 正文必须从二级标题 `##` 开始，严禁在正文第一行写 `# 一级标题`（Astro 布局会自动使用 `title` 渲染唯一的 h1）。

#### D. 草稿与下架
- **暂存为草稿**：在文章 frontmatter 头部添加 `draft: true`。草稿在 `npm run dev` 本地可见，但在 `npm run build` 和生产环境会自动排除，不会被打包，也不会进入 RSS / Sitemap。
- **永久删除**：直接删除对应的 `src/content/posts/<slug>.md` 文件，并用 git commit 提交删除。
- **修改 Slug / URL 重定向**：若修改了文件名（改变了文章 URL），为了防止外部死链，请在 `astro.config.mjs` 的 `redirects` 中配置 301 重定向：
  ```js
  redirects: {
    '/posts/old-slug/': '/posts/new-slug/',
  }
  ```

#### E. 发布与上线全流程
```bash
# 1. 本地启动开发服务器实时预览（支持草稿）
npm run dev

# 2. 发布前质量门禁自检（与 CI 保持一致）
npm run check && npm test && npm run build

# 3. 提交并推送到 GitHub 生产环境
git add .
git commit -m "post: 新增文章标题"
git push origin main
```
推送后 GitHub Actions 会自动执行 check、test、build 并部署到 GitHub Pages，全程约 1 分钟即可生效。

### 12.2 改自我介绍和关于页

全部在 `site.config.ts`：

| 想改的 | 字段 |
| --- | --- |
| 头像 | `avatar` |
| 「嗨，我是 mango 👋」 | `greeting`（支持 `<em>`，名字会变成渐变色） |
| 一句话简介 | `bio` |
| 终端里循环打出的句子 | `typing`（第一句也是无 JS 时显示的内容） |
| 方向卡片（首页 + 关于页） | `directions` |
| 技能墙 | `skills`（按分组） |

关于页的正文段落、「这个网站」「找到我」在 `src/pages/about.astro` 中直接改。

### 12.3 AI 日报自动发布

旧版的日报脚本会写入 `content/posts/<slug>.md`、`<slug>.meta.json` 和 `public/images/<slug>.png`。迁移后需要调整：

- **写入路径**改为 `src/content/posts/<slug>.md`
- **不再需要 meta.json**；frontmatter 里的 `title`、`date`、`excerpt` 足够，再加 `tags: [ai, 日报]`
- 图片路径不变，仍为 `public/images/`
- **推送分支**改为 `main`

frontmatter 中的旧字段（`category` 等）会被忽略，不会导致构建失败。

### 12.4 加一个导航项或单页

1. 新建 `src/pages/xxx.md`，frontmatter 写 `layout: ../layouts/Page.astro` 和 `title`
2. 在 `site.config.ts` 的 `nav` 中加一项

### 12.5 回滚到旧版

```bash
git checkout -b restore legacy/folk-canvas
git push origin restore
# 然后在 Actions 中用旧 workflow 发布，或把 restore 合并回 main
```

---

## 13. 刻意不做的事

这些功能考虑过，暂不做。需求真实出现时再加：

| 不做 | 原因 |
| --- | --- |
| 评论系统 | 需要第三方 JS 或后端；读者可以通过 GitHub 联系 |
| 文章站内搜索 | 文章不到 50 篇，标签 + 归档足够；之后可以加 Pagefind（纯静态） |
| 文章封面图 / 卡片大图 | 增加写作成本，文章页保持纯排版 |
| 多语言 | 目前只有中文读者 |
| 精选文章（featured） | 首页按时间展示最新文章，无需维护 |
| 文章分类 | 标签已覆盖，且一篇文章可以有多个（项目有分类，文章没有） |
| 访问统计 | 需要时优先选 Cloudflare Web Analytics（无 Cookie） |
| 设计稿、截图、AI 会话记录进仓库 | 放 PR 描述或 issue 中，主分支只放运行需要的东西 |

---

## 14. 验收清单

每次较大改动后检查：

- [ ] `npm run check` 通过（0 错误 / 0 警告）
- [ ] `npm test` 全绿
- [ ] `npm run build` 通过，无警告
- [ ] `find dist -name '*.js'` 输出为空
- [ ] 所有站内链接可达（无 404）
- [ ] 文章页：标题只出现一次、目录锚点可跳转、代码块明暗主题都正常
- [ ] 360px 宽的手机上无横向滚动
- [ ] 明暗两套主题下对比度正常，切换后刷新页面保持不变
- [ ] `/rss.xml` 条目数等于已发布文章数
- [ ] 项目页数量与 GitHub 上的原创公开仓库数一致
- [ ] 首页：头像、打字、数据条数字正确；方向卡片的项目数与项目页 tab 一致
- [ ] 项目页：`/projects/?cat=ai` 直达 AI 分类；搜索无结果时显示空状态；关掉 JS 能看到全部项目
- [ ] 默认暗色；切到亮色后刷新仍是亮色
