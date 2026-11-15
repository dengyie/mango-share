/**
 * Deep-link ids (`?card=` in the tab hash) must resolve on exact id/slug
 * only. The previous substring fallback made `#/u-cards?card=a` open the
 * first brand containing "a" — a shared link silently opened the wrong
 * product. In-page search covers fuzzy lookup; deep links stay exact.
 */
import { describe, expect, it } from 'vitest';
import { SIM_CARDS } from '../data/sim-cards';
import { CREDIT_CARDS } from '../data/credit-cards';
import { PERKS } from '../data/perks';
import { U_CARDS } from '../data/u-cards';
import { byDeepLink } from '../App';

describe('byDeepLink (exact match only)', () => {
  it('resolves a known id exactly', () => {
    const target = SIM_CARDS[0];
    expect(byDeepLink(SIM_CARDS, target.id)).toBe(target);
  });

  it('resolves u-cards by slug', () => {
    const target = U_CARDS.find((c) => c.slug)!;
    expect(byDeepLink(U_CARDS, target.slug)).toBe(target);
  });

  it('returns null for a substring that matches a name but no id', () => {
    const nameFragment = CREDIT_CARDS[0].name.toLowerCase().slice(0, 4);
    // The fragment is guaranteed to substring-match some name, but must not
    // resolve unless it happens to be an exact id.
    const resolved = byDeepLink(CREDIT_CARDS, nameFragment);
    if (resolved !== null) {
      expect(resolved.id).toBe(nameFragment);
    }
  });

  it('never resolves a single generic letter as a card', () => {
    // The old bug: "a" resolved to the first name containing "a".
    expect(byDeepLink(PERKS, 'a')).toBeNull();
    expect(byDeepLink(U_CARDS, 'a')).toBeNull();
    expect(byDeepLink(SIM_CARDS, 'a')).toBeNull();
  });

  it('returns null for unknown ids', () => {
    expect(byDeepLink(SIM_CARDS, 'no-such-card')).toBeNull();
    expect(byDeepLink(PERKS, 'no-such-perk')).toBeNull();
  });
});
