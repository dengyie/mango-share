---
title: "GitHub README 图片不更新？用文件名版本化绕过缓存"
date: 2026-10-05
description: "解释 GitHub Camo 与浏览器缓存为什么会让 README 图片长期显示旧版本，并给出稳定的文件名版本化更新流程。"
tags: [github, git, readme, cdn, cache]
---

## 问题：明明 push 成功，页面仍然是旧图

维护项目 README 时，最容易遇到的一类“假故障”是：新截图已经提交并推送，GitHub 网页却仍然显示旧内容。换浏览器、刷新页面，甚至在另一台设备上打开，结果都可能一样。

这通常不是 Git 没有推送成功，而是图片经历了两层缓存：GitHub 会把 README 中的图片交给 Camo 代理，访问者的浏览器又会对静态图片做本地磁盘缓存。同一个 URL 只要没有变化，中间层就可能继续返回旧二进制内容。

## 为什么只改图片内容不够

假设 README 原来引用的是：

```text
https://github.com/example/project/raw/main/docs/assets/dashboard.png
```

即使你用同一个文件名覆盖了图片，GitHub 页面最终请求的 Camo 地址仍然对应原来的源 URL。对缓存系统来说，这还是同一个资源：

```text
README 引用
    ↓
GitHub raw URL
    ↓
Camo CDN
    ↓
浏览器 Disk Cache
```

查询参数，例如 `dashboard.png?v=2`，在不同代理和渲染链路中的处理并不完全一致。有些场景会保留查询参数，有些场景则会对源 URL 归一化，因此它不是最稳妥的协作方案。更不能要求每个访客都执行一次强制刷新。

## 最可靠的策略：让 URL 物理变化

Web 缓存最确定的失效方式不是“请求缓存刷新”，而是让资源拥有一个全新的 URL。对 README 图片来说，最简单的实现就是文件名版本化：

```text
旧资源：docs/assets/dashboard.png
新资源：docs/assets/dashboard-v3.png
```

新文件名会让 Camo 和浏览器把它当作第一次见到的资源，首次请求自然会回源获取新图片。旧文件则可以删除，避免仓库里的截图不断累积。

这是一种 **Cache Busting by Name**：用名称变化代替对外部缓存系统的依赖。

## 四步更新 SOP

以把控制台截图升级到 v3 为例：

```bash
# 1. 使用新的版本化名称保存图片
cp /path/to/new-image.png docs/assets/dashboard-v3.png

# 2. 修改 README 中的引用
# dashboard-v2.png -> dashboard-v3.png

# 3. 清理已经淘汰的旧版本
git rm docs/assets/dashboard-v2.png

# 4. 一次提交资源与引用
git add README.md docs/assets/dashboard-v3.png
git commit -m "docs: update dashboard screenshot"
git push origin main
```

不要先推送新图片、过几分钟再改 README。把新文件、引用和旧文件删除放在同一个提交中，审查时更容易确认资源没有遗漏，也不容易留下指向不存在文件的链接。

## 如何确认问题确实解决

可以按下面顺序排查：

1. 在 GitHub 的文件列表中确认新文件确实存在。
2. 直接打开新的 raw URL，确认图片尺寸或内容是最新版本。
3. 在 README 中检查源码引用已经切换到新文件名。
4. 用无痕窗口或另一台设备打开页面，避免把本地缓存当成线上结果。
5. 如果新文件能打开而页面仍旧旧，检查是否访问了旧分支、旧标签或镜像站。

这个流程能把“代码没有推送”与“缓存没有失效”区分开：先验证 Git 内容，再验证网页渲染，不要一上来反复 force push。

## 什么时候不需要版本化

如果图片托管在你完全控制的 CDN 上，并且有可靠的 purge API、短缓存策略和可观测的回源验证，那么原路径覆盖也可以工作。但 README 面向的是不可控的第三方访问者，缓存节点、浏览器和镜像服务都不由项目维护者统一管理。对项目文档图片而言，版本化文件名通常是成本最低、结果最确定的默认选择。

## 小结

- 同名覆盖只改变内容，不改变缓存键。
- GitHub README 图片还会经过 Camo，浏览器也可能继续复用本地缓存。
- 最稳妥的更新方式是新建版本化文件名、同步修改 README、删除旧文件并一次提交。
- 用新 raw URL 和无痕窗口验证，能快速排除“推送失败”的误判。
