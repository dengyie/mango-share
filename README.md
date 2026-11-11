<!-- markdownlint-disable-file MD033 MD045 -->
<div align="center">

# MangoShare

**Swiss Paper-Ink Digital Asset, Global eSIM & Borderless Financial Resource Hub**

[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/React-18.3-blue.svg?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.3-646CFF.svg?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Go Version](https://img.shields.io/badge/Backend-Go_1.24+-00ADD8.svg?style=flat-square&logo=go&logoColor=white)](https://go.dev/)
[![Tests](https://img.shields.io/badge/tests-137%20passed-brightgreen.svg?style=flat-square)]()

[English](./README.md) · [简体中文](./README.zh-CN.md) · [Core Features](#core-features) · [Architecture](#system-architecture) · [Quick Start](#quick-start) · [Directory Pillars](#resource-directory-pillars) · [Sync Protocol](#account-sync--persistence-protocol)

<br>

<p align="center">
  <b>Terminates decision paralysis and deceptive promotional noise across global cross-border financial and telecommunication utilities.</b><br>
  Combines Swiss Paper-Ink aesthetics with responsive fluid contour backdrops and client-side offline-first persistence in an ultra-clean React architecture.<br>
  Features structured fee comparisons for Web3 crypto cards, global eSIM roaming diagnostics, real-time AI mirror health monitoring, and asynchronous Go-powered email authentication.
</p>

</div>

---

## Motivation & Architecture Comparison

Digital nomads, cross-border engineers, and global entrepreneurs frequently struggle to find transparent data regarding international payment cards, roaming SIMs, and overseas services. Most navigational portals are cluttered with affiliate ads, outdated exchange rates, and obfuscated fee structures:

| Evaluation Dimension | MangoShare Hub | Traditional Affiliate Link Portals | Commercial FinTech Comparison Sites |
| :--- | :--- | :--- | :--- |
| **Visual Aesthetics** | Minimalist Swiss Paper-Ink typography + fluid contour backdrop | Cluttered banner ads, flashing popups | Corporate dashboards with heavy tracking scripts |
| **Fee Transparency** | Explicit breakdown of deposit friction, exchange spreads, and KYC tiers | Hidden fees, promotional bias | Generic marketing summaries |
| **Offline First** | Full client-side browser persistence with guest-to-account migration | None (requires constant online connectivity) | Mandatory account creation before viewing |
| **Real-Time Diagnostics**| Live latency, model availability probes, and health monitoring | Dead links, unverified recommendations | Periodic manual updates |
| **Data Privacy** | Zero invasive third-party trackers; local-first state handling | Heavy analytics, Google Tag Manager, ad networks | Mandatory telemetry & cookie walls |
| **Full-Stack Engine** | React 18 SPA + lightweight modern Go/SQLite backend | Static WordPress or PHP CMS | Heavy cloud microservices |

---

## Core Features

| Module | Feature Highlight | Technical Implementation & Advantage |
| :--- | :--- | :--- |
| **Swiss Paper-Ink UI** | High-density clean typography | Built with custom CSS token design systems, fluid contour canvas rendering, and animated numerical counters. |
| **Web3 Crypto Cards** | Multi-attribute financial matrices | Structured fee breakdown for virtual and physical Visa/Mastercard debit cards, ATM support, and KYC level requirements. |
| **Global eSIM Navigator**| International roaming telecommunication | Verified coverage matrices, zero-monthly-fee SMS retention cards, APN configurations, and carrier roaming priority guides. |
| **Live AI Station Probes**| Real-time model endpoint verification | Direct integration with MangoApi telemetry, providing latency tracking, model availability catalogs, and status diagnostics. |
| **Developer Perks Pool** | Verified perks and vouchers | Vetted cloud infrastructure credits, free tier VPS instances, domain registration bargains, and digital nomad tooling. |
| **Offline-First Storage**| Frictionless guest-to-user sync | Local checklist items stored in browser `localStorage` with conflict-free server merging and quota overflow fallbacks. |
| **Async Go Auth Server** | Resilient credential-free authentication | Go backend leveraging embedded `modernc.org/sqlite`, leaky-bucket rate limiting, and async email OTP queues. |
| **Deep Link Routing** | Instant navigation to specific cards | Hash-based routing (`#/u-cards?card=depay`) supporting deep links, modal drawer states, and instantaneous clipboard sharing. |

---

## System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        User Browser Environment                        │
│  ├─ Swiss Paper-Ink Theme & Animated Counters (React 18)               │
│  ├─ Hash Route Controller & Deep-Link Parser                           │
│  └─ LocalStorage Client Vault (Offline-first checklist cache)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ JSON API & SSE (Vite Dev / Nginx Reverse Proxy)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   MangoShare Go API Backend (:8090)                    │
│  ┌──────────────────────┐ ┌──────────────────────┐ ┌────────────────┐  │
│  │ Rate Limiter Engine  │ │ Async Mailer Queue   │ │ Items Syncer   │  │
│  │ Leaky Bucket / IP    │ │ OneMail / SMTP Pipe  │ │ Tombstones Cap │  │
│  └──────────┬───────────┘ └──────────┬───────────┘ └────────┬───────┘  │
│             │                        │                      │          │
│             ▼                        ▼                      ▼          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │          modernc.org/sqlite Embedded Pure-Go Storage             │  │
│  │   Users · Sessions · Items Checklist · Deletion Tombstones       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Resource Directory Pillars

### 1. Global U-Cards & Crypto Spend (U-Cards)
- In-depth reviews covering top-tier Web3 virtual cards and physical debit cards.
- Structured parameter tables comparing deposit methods, cross-border conversion spreads, KYC validation steps, and ATM withdrawal capability.
- Instant access via deep-link hash routes (e.g. `#/u-cards?card=depay`).

### 2. International Telecommunications & Global eSIM (SIM Cards)
- Directory of zero-monthly-cost SMS receiving physical SIMs and instant-activation travel eSIMs.
- Clear documentation on carrier roaming tiers, APN settings, and SIM lifecycle maintenance.

### 3. Public AI Stations & Mirror Gateways (AI Station Hub)
- Curated index of high-reliability public model mirrors and OpenAI/Claude proxy channels.
- Real-time station synchronization with live model availability and latency metrics.

### 4. Global Nomad Banking & Developer Perks (Credit Cards & Perks)
- Strategic guides for acquiring multi-currency cross-border bank accounts and credit cards.
- Vetted repository of cloud computing coupons, developer subsidies, and productivity tools.

---

## Quick Start

### 1. Frontend Development

```bash
# Clone repository
git clone https://github.com/dengyie/mangoshare.git
cd mangoshare

# Install dependencies
npm install

# Start Vite hot-reloading dev server
npm run dev

# Run full frontend unit test suite (104 tests)
npm test
```

### 2. Backend Go Server

```bash
# Navigate to server directory
cd server

# Run backend test suite (33 tests)
go test -v ./...

# Launch server
go run main.go
```

The server listens on `http://127.0.0.1:8090` by default, managing user authentication and sync state with SQLite.

---

## Account Sync & Persistence Protocol

1. **Guest Isolation**: Visitors can bookmark cards and build personalized checklists without creating an account; records persist immediately to browser `localStorage`.
2. **Quota Resilience**: When browser storage hits storage quotas, fallback handlers preserve guest state in memory without corrupting user workflows.
3. **Seamless Login Migration**: Upon logging in via email OTP, guest checklists automatically merge with server records using conflict-free timestamp ordering.
4. **Tombstone Cleanup**: Deleted items leave bounded tombstones ensuring deletions propagate cleanly across multiple synchronized browsers.

---

## Configuration Reference

| Environment Variable | Default | Purpose |
| :--- | :--- | :--- |
| `ADDR` | `127.0.0.1:8090` | Listen address for the Go backend (loopback in production; nginx proxies `/account-api/`). |
| `DB_PATH` | `account.db` | Local file path for embedded SQLite storage (relative to the working directory). |
| `SITE_URL` | `https://share.mangoqwq.com` | Public site origin, used in mail copy. |
| `MAIL_FROM` | `MangoShare <noreply@otp.mangoqwq.com>` | Mail sender header (one-mail mode only reads the display name). |
| `ONE_MAIL_API_BASE` / `ONE_MAIL_SEND_TOKEN` | None | Preferred mail channel: one-mail Worker base URL and sender address JWT. |
| `RESEND_API_KEY` | None | Fallback mail channel: direct Resend API key (used when `ONE_MAIL_*` is unset). |
| `ADMIN_EMAILS` | None (Optional) | Comma-separated email list granted administrative privileges. |
| `TOKEN_TTL` | `720h` (30 days) | Sliding expiry for session tokens. |
| `CODE_TTL` | `10m` | Verification code validity window. |

Rate limits are built-in constants (not environment variables): 10 codes/hour/IP and 10 codes/24h/address; registration and password reset 10/hour/IP; login failures 20/15min/IP and 10/15min/account.

---

## Contributing & License

Contributions and improvements are welcome. Please ensure that all test suites pass before submitting changes:

```bash
# Frontend test pass
npm test

# Backend test pass
cd server && go test ./...
```

Licensed under the [MIT License](LICENSE).
