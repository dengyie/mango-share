---
title: "开源自动化框架怎么选：从浏览器到手机与视觉 Agent"
date: 2026-10-05
description: "按控制方式、运行端、可观测性和维护成本比较常见开源自动化框架，帮助你从场景而不是星标出发做技术选型。"
tags: [automation, browser, android, ai, open-source]
---

## 先问“要控制什么”，再问“用哪个框架”

自动化框架很容易陷入星标数量竞赛：浏览器有 Playwright、Selenium、DrissionPage，手机有 Appium、uiautomator2、Maestro，视觉 Agent 又有 Midscene、browser-use 等。它们解决的并不是同一个问题。

选型前先回答四个问题：

1. 目标是网页、原生移动应用、桌面窗口，还是多端混合？
2. 需要稳定的控件语义，还是只能依赖截图和视觉理解？
3. 流程是测试回归、数据采集、业务操作，还是开放式 Agent 探索？
4. 失败后是否需要截图、网络包、录像和可重放步骤来定位？

如果这些问题没有答案，直接比较 API 很容易选出“功能最多但最难维护”的方案。

## 四类控制模型

### 1. 浏览器协议控制

[Playwright](https://github.com/microsoft/playwright) 是工程化 Web 自动化的常见基线：浏览器、网络、断言、并行和追踪工具较完整，适合测试和确定性业务流程。

[DrissionPage](https://github.com/g1879/DrissionPage) 的特色是把 requests 与浏览器控制放进同一套 Python API，并通过 CDP 直连浏览器。需要在“HTTP 请求效率”和“浏览器页面能力”之间切换时，它的混合模式很有吸引力。

这类框架的共同优点是 DOM 和可访问性树提供了比像素坐标更稳定的语义；共同缺点是页面改版、登录态和验证码仍然需要人工设计恢复路径。

### 2. 移动端控件与设备控制

[uiautomator2](https://github.com/openatx/uiautomator2) 面向 Android 原生控件，设备端提供 HTTP 服务，Python 侧可以直接查找、点击和读取控件，不必引入完整的 Appium 驱动链。它适合单机或小规模设备控制，尤其适合希望保持依赖简单的项目。

[Appium](https://github.com/appium/appium) 仍然是跨平台移动测试的标准选项，生态和协议更完整，但部署层次也更多。遇到 iOS、复杂驱动或团队已有 Appium 基础设施时，它通常是更稳妥的兜底。

### 3. 声明式端到端流程

[Maestro](https://github.com/mobile-dev-inc/maestro) 用 YAML 描述测试步骤，并内置等待、重试和可视化工具。它的优势不是提供最多底层 API，而是让常见的端到端流程更容易阅读和交接：

```yaml
appId: com.example.app
---
- launchApp
- tapOn: "Sign in"
- inputText: "demo@example.com"
- tapOn: "Continue"
- assertVisible: "Dashboard"
```

如果团队需要的是“测试人员也能维护的流程文件”，声明式工具往往比一套更强大的编程 API 更合适。

### 4. 视觉与 Agent 控制

[Midscene](https://github.com/web-infra-dev/midscene) 代表的是视觉 GUI Agent 路线：模型根据截图和页面状态理解界面，跨 Web、Android、iOS 或桌面执行动作。[browser-use](https://github.com/browser-use/browser-use) 则更聚焦让语言模型操作 Web 浏览器。

视觉方案可以处理没有稳定选择器的界面，但代价是结果更难完全确定：同一个提示词可能因为页面细节、模型版本或截图变化产生不同动作。它们更适合探索性任务和人机协作，不应自动替代所有有明确状态机的流程。

## 反检测不是通用的“稳定性开关”

一些 Web 工具会强调指纹隐藏或反检测能力，例如 [Camoufox](https://github.com/daijro/camoufox) 和与 Playwright API 兼容的 [Patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright)。这类能力可能解决特定测试环境的兼容问题，但不等于可以绕过网站规则，也不等于业务流程本身更可靠。

用于授权测试时，应该优先关注：

- 是否符合目标站点的服务条款和测试范围；
- 是否有速率限制、测试账号和停止开关；
- 是否能记录每次动作，方便追责和复盘；
- 是否可以优先使用官方 API，而不是模拟用户界面。

把“反检测”当成默认架构，会掩盖登录态管理、幂等性和错误恢复等真正的工程问题。

## 设备农场什么时候值得引入

单机阶段通常不需要设备调度平台。只有当设备数量、并发任务和权限审计开始成为瓶颈时，才值得评估 [DeviceFarmer/stf](https://github.com/DeviceFarmer/stf) 或 [atxserver2](https://github.com/openatx/atxserver2)：

| 阶段 | 更合适的方案 | 主要原因 |
| --- | --- | --- |
| 单台 Android | uiautomator2 | 依赖少，调试直接 |
| 少量跨端测试 | Appium 或 Maestro | 协议和流程更统一 |
| 多台设备并行 | atxserver2 / STF | 分配、回收和审计设备 |
| 开放式 Web Agent | Playwright + browser-use | 保留底层控制能力 |

设备农场本身不能解决脚本幂等、账号隔离和测试数据污染。引入前应先把单机流程的状态边界定义清楚。

## 按场景做选择

可以把常见需求归纳成下面几条：

1. **Web 回归测试**：从 Playwright 开始，先建立稳定选择器、追踪和失败截图。
2. **Web 请求与浏览器混合**：评估 DrissionPage，减少两套客户端之间的状态搬运。
3. **Android 原生操作**：单机优先 uiautomator2；跨平台和团队标准化优先 Appium。
4. **测试流程交接**：选择 Maestro 这类声明式方案，让流程文件成为可审查的文档。
5. **没有稳定控件语义的探索任务**：再考虑视觉 Agent，并设置人工确认和预算边界。
6. **多设备并行**：先补齐设备生命周期、任务租约和日志，再引入设备农场。

## 数据快照与维护提醒

框架的星标、最近提交和平台支持会快速变化。任何横向对比都应该注明抓取日期，并在真正落地前重新查看官方仓库的 README、许可证、发布记录和已知问题。星标适合衡量社区热度，不适合单独证明稳定性。

最后，自动化系统最重要的指标通常不是“能不能点到按钮”，而是失败后能不能安全停止、重试是否幂等、状态是否可观测，以及换一台机器后能否复现。先把这些基础能力做好，再追求更聪明的 Agent，往往能得到更可靠的结果。
