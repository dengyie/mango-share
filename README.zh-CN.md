<!-- markdownlint-disable-file MD033 MD045 -->
<div align="center">

# MangoShare

**瑞士纸墨美学数字化资产导览、全球 eSIM 通信与无界金融决策中枢**

[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/React-18.3-blue.svg?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.3-646CFF.svg?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Go Version](https://img.shields.io/badge/Backend-Go_1.24+-00ADD8.svg?style=flat-square&logo=go&logoColor=white)](https://go.dev/)
[![Tests](https://img.shields.io/badge/tests-137%20passed-brightgreen.svg?style=flat-square)]()

[English](./README.md) · [简体中文](./README.zh-CN.md) · [核心特性](#核心特性) · [系统架构](#系统架构全景) · [快速上手](#快速上手) · [板块导览](#四大核心资源板块) · [多端同步](#账号同步与冲突解决机制)

<br>

<p align="center">
  <b>彻底告别跨境金融工具信息黑盒与传统导航网站垃圾广告堆砌的糟糕体验。</b><br>
  将瑞士现代主义纸墨排版、程序化流体等高线视觉与客户端离线隔离存储融为一体。<br>
  提供全球 Web3 加密卡损耗穿透测评、国际漫游 eSIM 实时资费对比、公益 AI 镜像站探活监测与基于 Go 原生后端的异步验证码鉴权。
</p>

</div>

---

## 痛点与架构对比

出海工程师、跨境电商从业者与数字游民在搜寻全球支付卡片与漫游网络时，常年受到虚假返利软文、过时费率与隐藏收费条款的误导。MangoShare 打造了一套透明化、纯净且高颜值的决策中枢：

| 评估维度 | MangoShare 决策中枢 | 传统返利与淘客导航网站 | 商业金融机构聚合门户 |
| :--- | :--- | :--- | :--- |
| **视觉与交互设计** | 极简瑞士纸墨排版 + 程序化流体等高线背景 | 充斥闪烁横幅广告、低俗弹窗 | 沉重刻板的企业级控制台，充斥追踪代码 |
| **费用结构透明度** | 穿透充值损耗、汇率点差、KYC 等级与隐性费用 | 刻意隐瞒费率，一味诱导返佣注册 | 泛泛而谈的公关营销话术 |
| **离线可用性** | 浏览器本地优先存储，支持免登录访客平滑迁移 | 依赖持续联网，无法离线暂存 | 强制必须先注册账号才能查看详情 |
| **实时可用性探活** | 接入 MangoApi 实时探测端点延迟与模型矩阵 | 大量死链、推荐早已跑路的平台 | 手动定期维护，信息极度滞后 |
| **隐私与数据纯净** | 零入侵性第三方跟踪脚本，核心数据本地掌控 | 植入大量跟踪像素与广告联盟 SDK | 强制要求 Cookie 同意与数据画像收集 |
| **全栈技术底座** | 现代 React 18 SPA + 嵌入式 Go/SQLite 异步服务 | 臃肿陈旧的 WordPress 或 PHP 模板 | 庞大而缓慢的商业微服务体系 |

---

## 核心特性

| 模块 | 特性亮点 | 技术实现与工程优势 |
| :--- | :--- | :--- |
| **瑞士纸墨美学** | 高密度清晰排版与流体背景 | 依托 CSS 变量与设计系统，内置 Canvas 程序化等高线渲染以及平滑动态数字翻牌计数器。 |
| **Web3 加密消费卡** | 多维费率对比决策矩阵 | 详尽收录主流虚拟卡与实体 Visa/Mastercard 借记卡，量化充值磨损、点差、ATM 提现与 KYC 门槛。 |
| **全球 eSIM 漫游导航**| 跨境网络与保号资源精选 | 覆盖全球主流低资费/零月租接收短信实体卡与秒级下发免实名旅游 eSIM，附带 APN 配置指引。 |
| **公益 AI 站点探活** | 镜像网关实时可用性追踪 | 深度集成 MangoApi 遥测能力，支持实时同步可用模型列表、延迟测速与服务在线健康度。 |
| **数字游民专属权益** | 精选免流与云服务福利池 | 汇聚全球优质免费 VPS、大厂云服务抵扣券、低价域名注册渠道以及出海开发者必备工具链。 |
| **本地优先暂存体系** | 访客向注册用户无感迁移 | 收藏清单以高容错形态落入浏览器 `localStorage`，支持登录后与服务端记录自动合并与防冲撞。 |
| **异步 Go 鉴权引擎** | 极简零凭证依赖的后端设计 | 基于纯 Go `modernc.org/sqlite` 构建，配备滑动窗口 IP 防爆破限流器与异步邮件验证码派发管道。 |
| **深度 Hash 路由机制** | 毫秒直达卡片并支持一键分享 | 深度参数化路由（如 `#/u-cards?card=depay`），支持抽屉弹窗状态联动与剪贴板一键提取分享。 |

---

## 系统架构全景

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        用户浏览器客户端环境                            │
│  ├─ 瑞士纸墨视觉组件库与平滑动态计数器 (React 18)                      │
│  ├─ Hash 深度链接解析与状态抽屉联动控制器                              │
│  └─ LocalStorage 本地离线隔离保险库 (免登录个人清单暂存)               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ JSON API 交互 (Vite 代理 / 反向代理)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  MangoShare Go 后端服务引擎 (:8090)                    │
│  ┌──────────────────────┐ ┌──────────────────────┐ ┌────────────────┐  │
│  │ 滑动窗口限流中间件   │ │ 异步邮件发信中枢     │ │ 清单数据同步器 │  │
│  │ 漏桶算法 / 客户端 IP │ │ OneMail / SMTP 队列  │ │ 墓碑机制防复活 │  │
│  └──────────┬───────────┘ └──────────┬───────────┘ └────────┬───────┘  │
│             │                        │                      │          │
│             ▼                        ▼                      ▼          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │            modernc.org/sqlite 纯 Go 原生嵌入式数据层             │  │
│  │       用户体系 · 登录态会话 · 个人清单收藏 · 软删除墓碑记录       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 四大核心资源板块

### 1. 全球 U 卡与加密消费金融 (U-Cards)
- 涵盖行业标杆级 Web3 虚拟卡与实体 Visa/Mastercard 借记卡评测；
- 结构化对比充值渠道、实际到账损耗、KYC 认证级别以及 ATM 实体取现支持；
- 借助 Hash 路由毫秒级直达详情弹窗（例如 `#/u-cards?card=depay`）。

### 2. 跨国通信与全球 eSIM 导航 (SIM Cards)
- 甄选全球主流零月租接收验证码保号实体卡与免实名极速激活的旅行 eSIM；
- 明确标注漫游合作网络优先级、APN 接入点配置规则与 SIM 卡充值延期生命周期。

### 3. 公益 AI 站点与镜像网关探活 (AI Station Hub)
- 精选全球优质免费/公益大模型镜像站、Claude/GPT 代理节点与 New API 分发渠道；
- 深度接入实时探测面板，毫秒呈现模型支持目录与端到端网络延迟。

### 4. 全球信用卡与数字游民权益 (Credit Cards & Perks)
- 精选海外多币种银行账户申请要点、跨境消费返现门槛与订阅支付技巧；
- 汇总全球主流云厂商代金券、免费算力平台与开发者专属福利清单。

---

## 快速上手

### 1. 前端开发与构建

```bash
# 克隆代码仓库
git clone https://github.com/dengyie/mangoshare.git
cd mangoshare

# 安装项目依赖
npm install

# 启动 Vite 热重载开发服务
npm run dev

# 运行前端全量测试套件 (104 项测试)
npm test
```

### 2. 运行 Go 后端服务

```bash
# 进入服务端代码目录
cd server

# 运行后端单元与集成测试 (33 项测试)
go test -v ./...

# 启动服务主程序
go run main.go
```

服务端默认监听于 `http://127.0.0.1:8090`，通过内嵌 SQLite 数据库提供跨端鉴权与清单同步。

---

## 账号同步与冲突解决机制

1. **访客安全隔离**：用户在未登录时可自由标记喜爱卡片并建立个人清单，数据即时落入浏览器 `localStorage`。
2. **存储超额保护**：当设备存储受限抛出 Quota 异常时，容错机制维持内存状态，绝不阻塞用户界面的交互操作。
3. **登录自动合流**：通过邮箱验证码完成登录后，访客暂存数据按时间戳优先级与服务端已存数据平滑融合。
4. **墓碑防复活**：已删除的项目记录被写入具有容量上限的墓碑列表（Tombstones），确保多端同步时已被删除的项不会意外复活。

---

## 配置参数参考

| 环境变量 | 默认值 | 配置说明 |
| :--- | :--- | :--- |
| `ADDR` | `127.0.0.1:8090` | Go 后端监听地址（生产绑定 loopback，由 nginx 反代 `/account-api/`）。 |
| `DB_PATH` | `account.db` | 内嵌 SQLite 数据库的文件保存路径（相对工作目录）。 |
| `SITE_URL` | `https://share.mangoqwq.com` | 公开站点域名，用于邮件文案。 |
| `MAIL_FROM` | `MangoShare <noreply@otp.mangoqwq.com>` | 邮件发件人（one-mail 模式仅取显示名）。 |
| `ONE_MAIL_API_BASE` / `ONE_MAIL_SEND_TOKEN` | 无 | 首选发信通道：one-mail Worker 地址与发件地址 JWT。 |
| `RESEND_API_KEY` | 无 | 备用发信通道：直连 Resend 的 API Key（`ONE_MAIL_*` 未设置时生效）。 |
| `ADMIN_EMAILS` | 无（可选） | 逗号分隔的管理员邮箱白名单列表。 |
| `TOKEN_TTL` | `720h`（30 天） | 会话令牌滑动过期时长。 |
| `CODE_TTL` | `10m` | 邮箱验证码有效期。 |

限流为代码内置常量（非环境变量）：发码 10 次/小时/IP 且每地址 10 次/24 小时；注册与重置 10 次/小时/IP；登录失败 20 次/15 分钟/IP、10 次/15 分钟/账号。

---

## 参与贡献与许可证

欢迎提交 Issue 与 Pull Request！在提交代码改动前，请确保全量测试套件执行通过：

```bash
# 前端测试验收
npm test

# 后端测试验收
cd server && go test ./...
```

本项目采用 [MIT License](LICENSE) 开源协议。
