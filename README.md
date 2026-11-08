<div align="center">

# MangoShare

**Swiss Paper-Ink Digital Asset, eSIM & Global Resource Hub**

[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/React-18.3-blue.svg?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.3-purple.svg?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg?style=flat-square)]()

[简体中文](./README.md) • [English](./README_EN.md)

</div>

---

## 项目简介 (Overview)

**MangoShare** 是一套遵循**瑞士现代主义（Swiss Modernism）**与**纸墨美学（Paper-Ink Aesthetics）**的高性能数字化资源导览与决策中枢。

系统摒弃了传统导航站混乱臃肿的视觉堆叠，融合了程序化流体等高线（Fluid Contour Backdrop）、优雅的物理质感排版与动态计数器，专为出海开发者、跨境从业者与数字游民提供透明、精准、结构化的全球资源决策矩阵。

---

## 核心功能矩阵 (Key Pillars)

### 1. 全球 U 卡与加密消费金融 (U-Cards)
- 涵盖主流 Web3 虚拟卡与实体 Visa/Mastercard 借记卡评测；
- 结构化对比充值费率、损耗点数、KYC 认证层级与 ATM 提现支持；
- 支持深度 Hash 路由直达卡片详情（如 `#/u-cards?card=depay`）。

### 2. 跨国通信与全球 eSIM 导航 (SIM Cards)
- 聚合全球主流出海流量卡、零月租接码保号实体卡与免实名即时激活 eSIM；
- 标注漫游网络优先级、APN 配置规则与充值生命周期。

### 3. 公益 AI 站点与模型实时探活 (AI Station Hub)
- 精选全球优质免费/公益大模型镜像站、Claude/GPT 代理节点与 New API 站点；
- **MangoApi 实时探活集成**：集成 API 同步面板（ApiSyncPanel），支持实时同步可用模型矩阵与延迟评测。

### 4. 全球信用卡与数字游民权益 (Credit Cards & Perks)
- 精选海外多币种信用卡申请通路、返现机制与出海订阅消费门槛；
- 汇聚云服务代金券、免费 VPS、域名解析与开发者专属福利池。

---

## 技术架构与设计亮点 (Architecture & Design)

```
┌────────────────────────────────────────────────────────┐
│                   MangoShare App Core                  │
├──────────────────────────┬─────────────────────────────┤
│   Presentation Layer     │   Swiss Paper-Ink Theme     │
│   - FluidContourBackdrop │   - CSS Variables & Tokens  │
│   - AnimatedCounter      │   - Tailwind Precision Grid │
│   - Hash Router Engine   │   - Deep Linking Parser     │
├──────────────────────────┼─────────────────────────────┤
│   Domain & Data Stores   │   External Integrations     │
│   - u-cards.ts           │   - MangoApi Model Sync     │
│   - sim-cards.ts         │   - LocalStorage Caching    │
│   - ai-stations.ts       │   - Session Auth Provider   │
└──────────────────────────┴─────────────────────────────┘
```

- **视觉引擎**：基于原生 WebGL/Canvas 的流体纸墨背景算法（`FluidContourBackdrop`），轻量级 GPU 加速，零高帧率卡顿。
- **状态流转**：无框架依赖的轻量 Hash Location 解析器，支持任意卡片一键分享与状态还原。
- **模块解耦**：所有业务卡片均抽象为独立类型定义（`types/`）与纯展示网格（`components/*/`），新增品类只需声明式扩充数据源。

---

## 快速上手 (Quick Start)

### 1. 环境准备
- Node.js >= 18.0.0
- npm / pnpm / yarn

### 2. 本地安装与启动
```bash
# 克隆仓库
git clone https://github.com/dengyie/mango-share.git
cd mango-share

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```
启动后在浏览器中打开 `http://localhost:5173` 即可浏览。

### 3. 测试与构建
```bash
# 运行单元测试
npm run test

# 生产级打包
npm run build
```

---

## 目录结构 (Directory Structure)

```
src/
├── components/          # 核心 UI 模块
│   ├── ai-hub/          # AI 公益站与模型探活面板
│   ├── awesome-ui/      # 瑞士纸墨风原子组件（流体背景、图标、计数器）
│   ├── credit-card/     # 全球信用卡矩阵
│   ├── perk/            # 数字化权益专区
│   ├── sim-card/        # 全球通信与 eSIM 列表
│   └── u-card/          # Web3 U卡与加密借记卡模块
├── data/                # 结构化数据源（卡片与站点事实字典）
├── hooks/               # 核心 Hook（数据同步、用户会话）
├── types/               # 强类型契约定义
└── App.tsx              # 主应用入口与路由分发
```

---

## 许可证 (License)

本项目采用 [MIT License](LICENSE) 开源协议。
