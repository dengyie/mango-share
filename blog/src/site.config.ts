// 站点配置：改文案、导航、方向卡片、项目分类、技能，只需要改这里
// 字段说明见 docs/DEVELOPMENT.md 第 4.3 节
import { withBase } from './lib/base';

export interface Direction {
  icon: string;
  title: string;
  text: string;
  /** 链到 /projects/?cat=<category>，并显示该分类的项目数 */
  category?: string;
  /** 不对应项目分类时，直接给链接 */
  href?: string;
  cta?: string;
}

export interface CategoryRule {
  id: string;
  label: string;
  /** 明确归到这一类的仓库名（优先） */
  repos: string[];
  /** 新仓库没列在上面时，按 GitHub topics 自动归类 */
  topics: string[];
}

export const SITE = {
  title: 'Little Lighthouse',
  description: 'mango 的技术笔记与开源项目：自动化、网络工具、AI，以及写代码时的思考。',
  url: 'https://share.mangoqwq.com',
  lang: 'zh-CN',
  author: 'mango',
  github: 'dengyie',
  avatar: 'https://avatars.githubusercontent.com/u/45208696?v=4',

  // ---------- 首页 Hero ----------
  greeting: '嗨，我是 <em>mango</em> 👋',
  bio: 'learning，living，loving · 只写自己平时真正需要用的东西',
  // 终端里循环打出的句子，第一句也是关掉 JS 时显示的内容
  typing: ['自动化 · 逆向 · 网络工具 · AI', 'Linux / VPS 折腾党', 'Cloudflare 重度用户', '深度 AI 依赖患者 🤖'],

  nav: [
    { label: '文章', href: '/posts/' },
    { label: '项目', href: '/projects/' },
    { label: '标签', href: '/tags/' },
    { label: '关于', href: '/about/' },
  ].map((item) => ({ ...item, href: withBase(item.href) })),

  // ---------- 我在折腾什么（首页 + 关于页） ----------
  directions: [
    { icon: '🤖', title: '自动化 & 逆向', text: '浏览器自动化、CDP、验证码、各类平台机器人', category: 'automation' },
    { icon: '🌐', title: '网络工具', text: '代理网关、DNS-over-HTTPS、分流诊断、网盘直链加速', category: 'network' },
    { icon: '🐧', title: 'Linux / VPS 折腾党', text: '自托管一切，Cloudflare 重度用户', href: withBase('/about/#skills'), cta: '看看我的工具箱' },
    { icon: '🧠', title: '深度 AI 依赖患者', text: 'LLM 网关、Agent 编排、AI 创作工具，什么模型都爱用', category: 'ai' },
  ] as Direction[],

  // ---------- 项目分类（项目页 tab） ----------
  // 匹配不到的仓库归到「其他」
  categories: [
    {
      id: 'ai',
      label: 'AI & LLM',
      repos: ['cnb2api', 'zcode2api', 'awesome-skills', 'agent-fleet', 'DallyReport', 'AI-Novel-Forge', 'OpenPet', 'decidex'],
      topics: ['ai', 'llm', 'openai', 'anthropic', 'claude', 'claude-code', 'gpt', 'gemini', 'agent', 'ai-agent', 'chatgpt'],
    },
    {
      id: 'automation',
      label: '自动化',
      repos: [
        'ai-register-machine', 'xianyu-auto-bot', 'slidex', 'daily-checkin', 'social-hub', 'game-auto-framework',
        'automation-kit', 'automation-app-dianping', 'automation-app-damai', 'damai-ticket-automation',
      ],
      topics: ['automation', 'playwright', 'selenium', 'puppeteer', 'bot', 'crawler', 'captcha', 'cdp', 'drissionpage'],
    },
    {
      id: 'network',
      label: '网络 & 自托管',
      repos: ['PanRouter', 'one-mail', 'cf-doh', 'mihomo-suite', 'mango-hub', 'mango-agent', '2fa-hub'],
      topics: ['proxy', 'dns', 'doh', 'self-hosted', 'selfhosted', 'cloudflare', 'cloudflare-workers', 'vpn', 'clash', 'mihomo'],
    },
  ] as CategoryRule[],

  // 首页「精选项目」，按顺序显示
  featuredProjects: ['zcode2api', 'ai-register-machine', 'cnb2api', 'xianyu-auto-bot', 'slidex', 'PanRouter'] as string[],
  // 不在项目页显示的仓库
  hiddenProjects: ['dengyie', 'dengyie.github.io'] as string[],

  // ---------- 关于页技能墙 ----------
  skills: {
    语言: ['TypeScript', 'JavaScript', 'Python', 'Go', 'Java', 'Kotlin', 'Dart'],
    框架: ['React', 'Vue', 'Next.js', 'Node.js', 'FastAPI', 'Flutter'],
    工具: ['Playwright', 'PyTorch', 'Hugging Face', 'Git'],
    基础设施: ['Cloudflare', 'Docker', 'Linux / VPS', 'Redis', 'PostgreSQL'],
  } as Record<string, string[]>,
};