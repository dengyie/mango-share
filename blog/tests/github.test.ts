import { describe, it, expect } from 'vitest';
import { calculateAccountYears, categorize } from '../src/lib/github';

describe('github lib', () => {
  describe('calculateAccountYears', () => {
    it('returns exact full years without premature rounding', () => {
      const created = '2018-11-20T16:30:05Z';
      // 2026年5月1日：未满8年，应为7年
      const beforeAnniversary = new Date('2026-05-01T00:00:00Z');
      expect(calculateAccountYears(created, beforeAnniversary)).toBe(7);

      // 2026年11月20日：刚好满8年
      const onAnniversary = new Date('2026-11-20T00:00:00Z');
      expect(calculateAccountYears(created, onAnniversary)).toBe(8);

      // 2026年12月1日：满8年
      const afterAnniversary = new Date('2026-12-01T00:00:00Z');
      expect(calculateAccountYears(created, afterAnniversary)).toBe(8);
    });

    it('returns 0 for accounts created within the same year before anniversary', () => {
      const created = '2026-06-01T00:00:00Z';
      const now = new Date('2026-10-17T00:00:00Z');
      expect(calculateAccountYears(created, now)).toBe(0);
    });
  });

  describe('categorize', () => {
    it('matches by repository name case-insensitively (highest priority)', () => {
      expect(categorize('CNB2API', [])).toBe('ai');
      expect(categorize('slidex', [])).toBe('automation');
      expect(categorize('PanRouter', [])).toBe('network');
    });

    it('matches by topics case-insensitively when name is unknown', () => {
      expect(categorize('unknown-repo', ['Agent', 'Python'])).toBe('ai');
      expect(categorize('unknown-repo', ['Playwright'])).toBe('automation');
      expect(categorize('unknown-repo', ['Cloudflare-Workers'])).toBe('network');
    });

    it('falls back to other when neither name nor topics match', () => {
      expect(categorize('some-random-library', ['random-topic'])).toBe('other');
    });
  });
});
