// 图标名清单：Icon.astro 渲染的内联 SVG 集合（Tabler 风格描边，MIT 惯例）。
// 单独放 lib 里是为了让 site.config 等模块能以类型安全的方式引用图标名。
export const ICON_NAMES = [
  'arrow-left',
  'arrow-right',
  'brand-github',
  'chevron-right',
  'coffee',
  'external-link',
  'globe',
  'moon',
  'rss',
  'search',
  'sparkles',
  'star',
  'sun',
  'terminal',
  'tool',
] as const;

export type IconName = (typeof ICON_NAMES)[number];
