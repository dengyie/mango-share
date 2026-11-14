---
title: "RecyclerView 缓存策略详解"
date: 2024-12-20
description: "RecyclerView 的多层缓存机制：Scrap、ViewCacheExtension 与 RecycledViewPool，以及 ViewHolder 模式的性能优化原理。"
tags: ["android", "recyclerview", "performance"]
---
## recycleView的缓存策略
RecyclerView 的缓存策略是为了提高性能，减少不必要的视图创建和销毁，避免频繁的 findViewById 操作。它通过一个叫做 ViewHolder 模式以及缓存池（Recycler 和 ViewCacheExtension）来管理可复用的视图，具体的缓存策略如下：

### 1. ViewHolder模式
每个 RecyclerView 的子项都由 ViewHolder 承载，ViewHolder 会缓存子项的视图引用，减少重复的 findViewById 操作。通过将视图数据绑定到 ViewHolder，可以提高滚动时的性能。

### 2. 缓存池机制
RecyclerView 使用多层缓存池来复用视图：

(1) Scrap 缓存
AttachedScrap：表示当前屏幕上显示的 item 缓存。当某个 item 被滑出屏幕但尚未完全移除时，会进入此缓存。RecyclerView 不会立即销毁这些视图，而是保留在缓存中，以便后续快速复用。
ChangedScrap：当 RecyclerView 的 adapter 数据发生更新时，表示数据发生改变的 item 缓存。
(2) ViewCacheExtension
这是一个可选的扩展机制，允许开发者自定义缓存策略，管理额外的缓存。如果 RecyclerView 没有从 Scrap 中找到合适的视图，就会尝试从 ViewCacheExtension 中查找。

(3) Recycler 缓存 (RecycledViewPool)
当 RecyclerView 回收某个不可见的视图时，视图会被存放在 Recycler 中的缓存池（RecycledViewPool）。这些视图会按类型分类（viewType），在未来的 onBindViewHolder() 调用中复用。默认情况下，每种类型的视图缓存 5 个，可以通过 setRecycledViewPool 或 setMaxRecycledViews 来控制最大缓存数量。

### 3. ItemViewType的影响
RecyclerView 的缓存池是基于 itemViewType 来区分的。相同类型的视图可以复用，而不同类型的视图不能复用。所以合理使用 getItemViewType() 来区分不同的布局类型是缓存策略的关键。

### 4. 回收和复用流程
当某个 View 滑出屏幕时，RecyclerView 首先会将其放入 Scrap 缓存。
如果 RecyclerView 需要一个新的 View 时，首先从 Scrap 缓存查找合适的视图。
如果 Scrap 中找不到，则从 Recycler 的 RecycledViewPool 中寻找。
如果还找不到，则会通过 Adapter 的 onCreateViewHolder 创建一个新的视图。
通过这套缓存机制，RecyclerView 能够有效提升性能，特别是在大量数据、频繁滚动的情况下，显著减少视图的重复创建和内存开销。
