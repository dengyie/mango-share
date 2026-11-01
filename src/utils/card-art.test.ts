/**
 * Tests for the AI station card art: the host is the card identity (falling
 * back to the name when portalUrl is missing/unparseable), interpolated text
 * is XML-escaped, long hosts shrink their font, and the health badge follows
 * the real probe state instead of a hardcoded "ONLINE".
 */
import { describe, expect, it } from 'vitest';
import { getAiStationArt, getStationHost, getSimCardArt, getCreditCardArt } from './card-art';

function decodeArt(dataUri: string): string {
  const base64 = dataUri.replace('data:image/svg+xml;base64,', '');
  // atob avoids a Node-only Buffer dependency so the test also typechecks
  // under the app's browser-only tsconfig lib set.
  return decodeURIComponent(escape(atob(base64)));
}

describe('SIM and credit card gradients', () => {
  it('emits the actual SIM color stops', () => {
    const svg = decodeArt(getSimCardArt('giffgaff', 'giffgaff', 'GB', 'UK', ['SIM']));
    expect(svg).toContain('stop-color="#18181a"');
    expect(svg).toContain('stop-color="#0d0d0f"');
  });

  it('preserves every credit-card gradient stop and solid colors', () => {
    const svg = decodeArt(getCreditCardArt('a', 'Card', 'Issuer', 'Visa', 'US', 'linear-gradient(135deg, #d4af37 0%, #aa771c 50%, #593e0b 100%)'));
    expect(svg).toContain('offset="0%" stop-color="#d4af37"');
    expect(svg).toContain('offset="50%" stop-color="#aa771c"');
    expect(svg).toContain('offset="100%" stop-color="#593e0b"');
    expect(decodeArt(getCreditCardArt('a', 'Card', 'Issuer', 'Visa', 'US', '#abcdef'))).toContain('fill="#abcdef"');
  });
});

describe('getStationHost', () => {
  it('returns the bare host of a valid portal URL', () => {
    expect(getStationHost({ name: '一鸣公益站', portalUrl: 'https://newapi.yimingtalk.online/profile' }))
      .toBe('newapi.yimingtalk.online');
  });

  it('keeps the port for non-default-port origins', () => {
    expect(getStationHost({ name: 'x', portalUrl: 'https://doleapi.cc.cd:20362/' }))
      .toBe('doleapi.cc.cd:20362');
  });

  it('falls back to the name when portalUrl is missing', () => {
    expect(getStationHost({ name: 'Fallback 站' })).toBe('Fallback 站');
  });

  it('falls back to the name when portalUrl is unparseable', () => {
    expect(getStationHost({ name: 'Fallback 站', portalUrl: 'not a url' })).toBe('Fallback 站');
  });
});

describe('getAiStationArt', () => {
  const base = {
    id: 'yiming',
    name: '一鸣公益站',
    category: 'NewAPI',
    models: ['gpt-5.5', 'deepseek-v4-pro'],
    portalUrl: 'https://newapi.yimingtalk.online/profile',
  };

  it('renders the URL host as the card face name', () => {
    const svg = decodeArt(getAiStationArt(base.id, base.name, base.category, base.models, base.portalUrl));
    expect(svg).toContain('newapi.yimingtalk.online');
    expect(svg).toContain('一鸣公益站');
  });

  it('XML-escapes interpolated name and model text', () => {
    const svg = decodeArt(getAiStationArt('x', 'A <b> & "Q"', 'Gateway', ['m<1', 'a&b'], 'https://a.example.com'));
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&lt;b&gt;');
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&quot;');
  });

  it('shrinks the host font for very long hosts', () => {
    const longHost = `https://${'a'.repeat(45)}.example.com/`;
    const svg = decodeArt(getAiStationArt('x', 'n', 'Gateway', [], longHost));
    expect(svg).toContain('font-size="14"');
  });

  it('renders no health badge when health is unknown', () => {
    const svg = decodeArt(getAiStationArt(base.id, base.name, base.category, base.models, base.portalUrl));
    expect(svg).not.toContain('ONLINE');
    expect(svg).not.toContain('UNREACHABLE');
  });

  it('renders the ONLINE badge only for the online state', () => {
    const svg = decodeArt(getAiStationArt(base.id, base.name, base.category, base.models, base.portalUrl, 'online'));
    expect(svg).toContain('● ONLINE');
    expect(svg).not.toContain('UNREACHABLE');
  });

  it('renders the UNREACHABLE badge for the degraded state', () => {
    const svg = decodeArt(getAiStationArt(base.id, base.name, base.category, base.models, base.portalUrl, 'degraded'));
    expect(svg).toContain('● UNREACHABLE');
    expect(svg).not.toContain('● ONLINE');
  });

  it('produces a stable, station-specific gradient per id', () => {
    const a = decodeArt(getAiStationArt('yiming', 'n', 'Gateway', [], 'https://a.example.com'));
    const b = decodeArt(getAiStationArt('yiming', 'n', 'Gateway', [], 'https://a.example.com'));
    const c = decodeArt(getAiStationArt('amnew', 'n', 'Gateway', [], 'https://b.example.com'));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
