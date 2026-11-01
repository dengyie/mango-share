// Utility to generate authentic, high-resolution SVG card faces (85.6 : 54 credit card aspect ratio)
// Perfectly matching the tactile paper/ink minimalist aesthetic of nicecard / card.mangoqwq.com

function escapeXml(unsafe: string | null | undefined): string {
  if (unsafe == null) return '';
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function svgToDataUri(svg: string): string {
  // Use Base64 encoding with proper UTF-8 handling for 100% reliable cross-browser SVG rendering
  // Eliminates WebKit/Safari MIME parameter parsing failures and unescaped entity breakages
  try {
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = (globalThis as unknown as { Buffer?: { from: (s: string, e: string) => { toString: (e: string) => string } } }).Buffer;
    if (buf) {
      return `data:image/svg+xml;base64,${buf.from(svg, 'utf-8').toString('base64')}`;
    }
  } catch {
    // Fallback to RFC-compliant percent-encoded data URI with explicit charset
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Card palettes use CSS linear gradients with hexadecimal color stops. Translate
// each stop instead of indexing whitespace-separated tokens (which loses stops).
function gradientStops(bg: string): string {
  const stops = [...bg.matchAll(/(#[\da-fA-F]{3,8})\s+(\d+(?:\.\d+)?%)/g)];
  return stops.map(([, color, offset]) => `<stop offset="${offset}" stop-color="${color}" />`).join('\n        ');
}

export function getSimCardArt(id: string, name: string, countryCode: string, country: string, form: string[]): string {
  const configs: Record<string, { bg: string; accent: string; text: string; sub: string }> = {
    giffgaff: {
      bg: 'linear-gradient(135deg, #18181a 0%, #0d0d0f 100%)',
      accent: '#ffe600',
      text: '#ffffff',
      sub: '#a1a1aa'
    },
    clubsim: {
      bg: 'linear-gradient(135deg, #f05a28 0%, #c43809 100%)',
      accent: '#ffffff',
      text: '#ffffff',
      sub: '#fcdcd1'
    },
    'ultra-paygo': {
      bg: 'linear-gradient(135deg, #431268 0%, #200438 100%)',
      accent: '#f9a825',
      text: '#ffffff',
      sub: '#d8b4f8'
    },
    skinny: {
      bg: 'linear-gradient(135deg, #ff5722 0%, #e64a19 100%)',
      accent: '#00e5ff',
      text: '#ffffff',
      sub: '#ffe0b2'
    },
    '3hk-diy': {
      bg: 'linear-gradient(135deg, #0d233a 0%, #040c14 100%)',
      accent: '#00bcd4',
      text: '#ffffff',
      sub: '#90caf9'
    },
    helium: {
      bg: 'linear-gradient(135deg, #0a2e22 0%, #03140e 100%)',
      accent: '#26d97f',
      text: '#ffffff',
      sub: '#a7f3d0'
    },
    '5ber': {
      bg: 'linear-gradient(135deg, #262930 0%, #111216 100%)',
      accent: '#60a5fa',
      text: '#ffffff',
      sub: '#9ca3af'
    },
    airalo: {
      bg: 'linear-gradient(135deg, #1e3a5f 0%, #102035 100%)',
      accent: '#f97316',
      text: '#ffffff',
      sub: '#cbd5e1'
    }
  };

  const c = configs[id] || {
    bg: 'linear-gradient(135deg, #27272a 0%, #18181b 100%)',
    accent: '#10b981',
    text: '#ffffff',
    sub: '#a1a1aa'
  };

  const formText = form.join(' / ');
  const safeId = escapeXml(id);
  const safeCountryCode = escapeXml((countryCode || 'SIM').toUpperCase().slice(0, 4));
  const safeName = escapeXml(name.split(' ')[0]);
  const safeForm = escapeXml(formText.toUpperCase());
  const safeCountry = escapeXml(country);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 428 270" width="428" height="270">
    <defs>
      <linearGradient id="g_${safeId}" x1="0%" y1="0%" x2="100%" y2="100%">
        ${gradientStops(c.bg)}
      </linearGradient>
      <!-- SIM Chip pattern -->
      <pattern id="chipGrid" width="6" height="6" patternUnits="userSpaceOnUse">
        <path d="M 6 0 L 0 0 0 6" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="0.8"/>
      </pattern>
    </defs>

    <rect width="428" height="270" rx="16" fill="url(#g_${safeId})" />
    <rect width="428" height="270" rx="16" fill="url(#chipGrid)" />

    <!-- Border highlight -->
    <rect x="1" y="1" width="426" height="268" rx="15" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.2" />

    <!-- Country Code Badge & Brand -->
    <rect x="32" y="24" width="38" height="24" rx="6" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" stroke-width="1" />
    <text x="51" y="40" text-anchor="middle" fill="#ffffff" font-family="monospace" font-weight="800" font-size="12" letter-spacing="1">${safeCountryCode}</text>
    <text x="78" y="42" fill="${c.text}" font-family="Inter, -apple-system, sans-serif" font-weight="700" font-size="19" letter-spacing="0.5">${safeName}</text>
    <text x="428" y="42" text-anchor="end" dx="-32" fill="${c.accent}" font-family="Inter, -apple-system, sans-serif" font-weight="600" font-size="12" letter-spacing="1">${safeForm}</text>

    <!-- Golden SIM Chip Graphic -->
    <g transform="translate(32, 85)">
      <rect width="52" height="42" rx="6" fill="#e5b558" stroke="#ca9b39" stroke-width="1" />
      <path d="M16 0 v42 M36 0 v42 M0 21 h52 M0 12 h16 M36 12 h16 M0 30 h16 M36 30 h16" stroke="#997020" stroke-width="1.2" fill="none" />
      <circle cx="26" cy="21" r="5" fill="#ca9b39" />
    </g>

    <!-- Signal waves icon -->
    <path d="M102 108 A12 12 0 0 1 102 120 M108 103 A20 20 0 0 1 108 125 M114 98 A28 28 0 0 1 114 130" stroke="rgba(255,255,255,0.35)" stroke-width="2.5" fill="none" stroke-linecap="round" />

    <!-- Footer Meta -->
    <text x="32" y="210" fill="${c.sub}" font-family="Inter, -apple-system, sans-serif" font-size="12" font-weight="500">${safeCountry} · 全球漫游保号卡</text>
    <text x="32" y="234" fill="${c.text}" font-family="monospace" font-size="14" letter-spacing="2">8944 •••• •••• 2026</text>

    <!-- Right Brand watermark -->
    <text x="396" y="234" text-anchor="end" fill="rgba(255,255,255,0.25)" font-family="Inter, sans-serif" font-weight="800" font-size="15" letter-spacing="1.5">MANGO SHARE</text>
  </svg>`;

  return svgToDataUri(svg);
}

// FNV-1a over the card id so each station gets a stable hue pair without
// hand-maintaining a per-station color table.
function hashHuePair(id: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const h1 = (h >>> 0) % 360;
  const h2 = (h1 + 40 + ((h >>> 8) % 80)) % 360;
  return [h1, h2];
}

// Single source of truth for a station's display host: "https://a.b/c" ->
// "a.b". Unparseable or missing URLs fall back to the station name so a card
// never renders an empty identity line.
export function getStationHost(station: { name: string; portalUrl?: string }): string {
  const url = station.portalUrl;
  if (url) {
    try {
      const host = new URL(url).host;
      if (host) return host;
    } catch {
      // fall through to the name
    }
  }
  return station.name;
}

export type AiStationCardHealth = 'online' | 'degraded' | 'unknown';

export function getAiStationArt(
  id: string,
  name: string,
  category: string,
  models: string[],
  portalUrl?: string,
  health: AiStationCardHealth = 'unknown'
): string {
  const host = getStationHost({ name, portalUrl });
  const [h1, h2] = hashHuePair(id || host);
  const safeId = escapeXml((id || 'station').replace(/[^a-zA-Z0-9_-]/g, '-'));
  const safeCategory = escapeXml(category);
  const safeHost = escapeXml(host);
  const safeName = escapeXml(name);
  const safeModels = escapeXml(models.slice(0, 3).join(' · '));

  // ~7px per glyph at 22px monospace: shrink the host until it fits the card.
  const hostFontSize = host.length > 40 ? 14 : host.length > 30 ? 17 : 22;

  // The badge must reflect the real probe result: painting "ONLINE" on a card
  // whose detail row says "测速超时" contradicts the one signal users pick
  // stations by. 'unknown' renders no badge at all (e.g. the detail modal,
  // which runs no probe of its own).
  const healthBadge =
    health === 'online'
      ? `<text x="396" y="226" text-anchor="end" fill="#34d399" font-family="Inter, sans-serif" font-weight="600" font-size="12">● ONLINE</text>`
      : health === 'degraded'
      ? `<text x="396" y="226" text-anchor="end" fill="#f97316" font-family="Inter, sans-serif" font-weight="600" font-size="12">● UNREACHABLE</text>`
      : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 428 270" width="428" height="270">
    <defs>
      <linearGradient id="ai_bg_${safeId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl(${h1}, 48%, 15%)" />
        <stop offset="100%" stop-color="hsl(${h2}, 55%, 7%)" />
      </linearGradient>
      <linearGradient id="ai_sheen_${safeId}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.03)" />
        <stop offset="50%" stop-color="rgba(255,255,255,0.11)" />
        <stop offset="100%" stop-color="rgba(255,255,255,0.03)" />
      </linearGradient>
      <pattern id="ai_dots_${safeId}" width="12" height="12" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1" fill="rgba(255,255,255,0.055)" />
      </pattern>
    </defs>

    <rect width="428" height="270" rx="16" fill="url(#ai_bg_${safeId})" />
    <rect width="428" height="270" rx="16" fill="url(#ai_dots_${safeId})" />
    <rect width="428" height="270" rx="16" fill="url(#ai_sheen_${safeId})" />
    <rect x="1" y="1" width="426" height="268" rx="15" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1.2" />

    <!-- Category badge -->
    <rect x="32" y="28" width="86" height="24" rx="12" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.18)" stroke-width="1" />
    <circle cx="45" cy="40" r="3.5" fill="#34d399" />
    <text x="56" y="44" fill="rgba(255,255,255,0.85)" font-family="Inter, sans-serif" font-size="11" font-weight="600">${safeCategory}</text>
    <text x="396" y="45" text-anchor="end" fill="rgba(255,255,255,0.4)" font-family="Inter, sans-serif" font-weight="700" font-size="12" letter-spacing="1.5">AI NODE</text>

    <!-- Host as the card face name -->
    <text x="32" y="118" fill="#f4f4f5" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="${hostFontSize}" font-weight="700" letter-spacing="0.2">${safeHost}</text>
    <text x="32" y="146" fill="rgba(255,255,255,0.55)" font-family="Inter, -apple-system, sans-serif" font-size="13" font-weight="500">${safeName}</text>

    <!-- Signal waves -->
    <path d="M32 185 C100 170, 150 196, 220 181 S330 168, 396 186" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" stroke-dasharray="4 3" />

    <!-- Footer -->
    <text x="32" y="226" fill="rgba(255,255,255,0.6)" font-family="ui-monospace, monospace" font-size="12">${safeModels}</text>
    ${healthBadge}
  </svg>`;

  return svgToDataUri(svg);
}

export function getCreditCardArt(
  id: string,
  name: string,
  issuer: string,
  network: string,
  regionName: string,
  cardBgColor?: string,
  cardTextColor: string = '#ffffff'
): string {
  const bg = cardBgColor || 'linear-gradient(135deg, #1f2937 0%, #111827 100%)';
  const shortName = name.split(' (')[0].replace('American Express ', 'Amex ');
  const safeId = escapeXml(id);
  const safeIssuer = escapeXml(issuer);
  const safeRegionName = escapeXml(regionName);
  const safeShortName = escapeXml(shortName);

  const networkLogo =
    network === 'Visa'
      ? `<text x="396" y="234" text-anchor="end" fill="#ffffff" font-family="Inter, sans-serif" font-weight="900" font-style="italic" font-size="22" letter-spacing="1">VISA</text>`
      : network === 'Mastercard'
      ? `<g transform="translate(352, 212)">
           <circle cx="16" cy="16" r="16" fill="#eb001b" opacity="0.9" />
           <circle cx="32" cy="16" r="16" fill="#f79e1b" opacity="0.9" />
         </g>`
      : network === 'American Express'
      ? `<text x="396" y="234" text-anchor="end" fill="#006fcf" font-family="Inter, sans-serif" font-weight="900" font-size="16" letter-spacing="0.5">AMERICAN EXPRESS</text>`
      : `<text x="396" y="234" text-anchor="end" fill="#d90429" font-family="Inter, sans-serif" font-weight="800" font-size="18">UnionPay 银联</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 428 270" width="428" height="270">
    <defs>
      <linearGradient id="cc_bg_${safeId}" x1="0%" y1="0%" x2="100%" y2="100%">
        ${gradientStops(bg)}
      </linearGradient>
      <linearGradient id="foil_${safeId}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.05)" />
        <stop offset="50%" stop-color="rgba(255,255,255,0.2)" />
        <stop offset="100%" stop-color="rgba(255,255,255,0.05)" />
      </linearGradient>
    </defs>

    <rect width="428" height="270" rx="16" fill="${bg.startsWith('linear-gradient') ? `url(#cc_bg_${safeId})` : bg}" />
    <rect width="428" height="270" rx="16" fill="url(#foil_${safeId})" />
    <rect x="1" y="1" width="426" height="268" rx="15" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.2" />

    <!-- Issuer & Region Tag -->
    <text x="32" y="42" fill="${cardTextColor}" font-family="Inter, -apple-system, sans-serif" font-weight="700" font-size="16" letter-spacing="0.5">${safeIssuer}</text>
    <rect x="340" y="26" width="56" height="20" rx="10" fill="rgba(255,255,255,0.15)" />
    <text x="368" y="40" text-anchor="middle" fill="#ffffff" font-family="Inter, sans-serif" font-weight="600" font-size="11">${safeRegionName}</text>

    <!-- Metallic EMV Chip -->
    <g transform="translate(32, 74)">
      <rect width="50" height="38" rx="5" fill="#d4af37" stroke="#aa771c" stroke-width="1" />
      <path d="M15 0 v38 M35 0 v38 M0 19 h50 M0 10 h15 M35 10 h15 M0 28 h15 M35 28 h15" stroke="#775010" stroke-width="1.2" fill="none" />
      <circle cx="25" cy="19" r="4.5" fill="#aa771c" />
    </g>

    <!-- Wireless Contactless Symbol -->
    <path d="M96 90 A10 10 0 0 1 96 100 M101 86 A16 16 0 0 1 101 104 M106 82 A22 22 0 0 1 106 108" stroke="rgba(255,255,255,0.4)" stroke-width="2.2" fill="none" stroke-linecap="round" />

    <!-- Card Name & Embossed Numbers -->
    <text x="32" y="172" fill="${cardTextColor}" font-family="Inter, -apple-system, sans-serif" font-size="17" font-weight="700" letter-spacing="-0.2">${safeShortName}</text>
    <text x="32" y="210" fill="rgba(255,255,255,0.75)" font-family="monospace" font-size="15" letter-spacing="3">•••• •••• •••• 8888</text>
    <text x="32" y="234" fill="rgba(255,255,255,0.6)" font-family="Inter, sans-serif" font-size="11" letter-spacing="1">EXP 12/29</text>

    <!-- Payment Network Logo -->
    ${networkLogo}
  </svg>`;

  return svgToDataUri(svg);
}

const PERK_SVG_ICONS: Record<string, string> = {
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />',
  server: '<g fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></g>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />',
  'graduation-cap': '<g fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></g>',
  code: '<g fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 9-3 3 3 3m8-6 3 3-3 3" /><path d="m14 5-4 14" /></g>',
  globe: '<g fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></g>',
  link: '<g fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></g>',
  'trending-up': '<g fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></g>',
  'credit-card': '<g fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></g>',
  gift: '<g fill="none" stroke="#f472b6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13m7-9v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7m2.5-4a2.5 2.5 0 0 1 0-5A4.8 4.8 0 0 1 12 8a4.8 4.8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" /></g>'
};

export function getPerkArt(
  id: string,
  name: string,
  categoryName: string,
  provider: string,
  rewardValue: string,
  iconName: string = 'gift'
): string {
  const shortName = name.split(' (')[0];
  const valueShort = rewardValue.split(' (')[0];
  const safeId = escapeXml(id);
  const safeProvider = escapeXml(provider);
  const safeCategoryName = escapeXml(categoryName);
  const safeShortName = escapeXml(shortName);
  const safeValueShort = escapeXml(valueShort);
  const vectorIcon = PERK_SVG_ICONS[iconName] || PERK_SVG_ICONS.gift;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 428 270" width="428" height="270">
    <defs>
      <linearGradient id="perk_bg_${safeId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#18181b" />
        <stop offset="100%" stop-color="#09090b" />
      </linearGradient>
      <!-- Ticket coupon dashed line -->
      <pattern id="ticketGrid" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="none" />
        <circle cx="4" cy="4" r="0.8" fill="rgba(255,255,255,0.06)" />
      </pattern>
    </defs>

    <rect width="428" height="270" rx="16" fill="url(#perk_bg_${safeId})" />
    <rect width="428" height="270" rx="16" fill="url(#ticketGrid)" />
    <rect x="1" y="1" width="426" height="268" rx="15" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.2" />

    <!-- Top Badge & Provider -->
    <g transform="translate(32, 22)">
      <rect width="32" height="32" rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
      <g transform="translate(6, 6) scale(0.833)">
        ${vectorIcon}
      </g>
    </g>
    <text x="74" y="43" fill="#fafafa" font-family="Inter, -apple-system, sans-serif" font-weight="700" font-size="15">${safeProvider}</text>
    <rect x="310" y="26" width="86" height="22" rx="11" fill="rgba(245,158,11,0.15)" stroke="rgba(245,158,11,0.4)" stroke-width="1" />
    <text x="353" y="41" text-anchor="middle" fill="#fbbf24" font-family="Inter, sans-serif" font-weight="600" font-size="11">${safeCategoryName}</text>

    <!-- Ticket perforated separator -->
    <line x1="32" y1="72" x2="396" y2="72" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" stroke-dasharray="4 4" />

    <!-- Name & Value -->
    <text x="32" y="116" fill="#ffffff" font-family="Inter, -apple-system, sans-serif" font-size="19" font-weight="800" letter-spacing="-0.3">${safeShortName}</text>
    <rect x="32" y="136" width="364" height="42" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
    
    <!-- Sparkle Vector Icon -->
    <g transform="translate(46, 149)">
      <path d="m8 2-1 3.5L3.5 6.5l3.5 1L8 11l1-3.5 3.5-1L9 5.5z" fill="#38bdf8" />
    </g>
    <text x="66" y="162" fill="#38bdf8" font-family="Inter, monospace" font-size="13" font-weight="600">${safeValueShort}</text>

    <!-- Barcode style ticket footer -->
    <g transform="translate(32, 206)">
      <rect x="0" y="0" width="3" height="24" fill="rgba(255,255,255,0.4)" />
      <rect x="6" y="0" width="1.5" height="24" fill="rgba(255,255,255,0.4)" />
      <rect x="11" y="0" width="4" height="24" fill="rgba(255,255,255,0.4)" />
      <rect x="18" y="0" width="2" height="24" fill="rgba(255,255,255,0.4)" />
      <rect x="23" y="0" width="5" height="24" fill="rgba(255,255,255,0.4)" />
      <rect x="31" y="0" width="2" height="24" fill="rgba(255,255,255,0.4)" />
      <rect x="36" y="0" width="3" height="24" fill="rgba(255,255,255,0.4)" />
      <rect x="42" y="0" width="1" height="24" fill="rgba(255,255,255,0.4)" />
    </g>
    <text x="88" y="222" fill="#71717a" font-family="monospace" font-size="11" letter-spacing="1">PASS-2026-ALWAYS-FREE</text>
    <text x="372" y="222" text-anchor="end" fill="#34d399" font-family="Inter, sans-serif" font-weight="600" font-size="12">CLAIM PASS</text>
    <path d="M382 216 l5 -5 m0 0 h-4 m4 0 v4" fill="none" stroke="#34d399" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;

  return svgToDataUri(svg);
}
