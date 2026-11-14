import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // 托管在 share.mangoqwq.com 的 /blog/ 子路径（tencent-lh nginx，见 ../deploy/nginx-mangoshare.conf）
  site: 'https://share.mangoqwq.com',
  base: '/blog',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
  // 旧版 /categories/* 链接兼容不再走 Astro redirects（带 base 时 stub 目标不会加前缀），
  // 改由 Cloudflare Redirect Rule 统一 301（见 docs/DEVELOPMENT.md 第 5 节）。
});