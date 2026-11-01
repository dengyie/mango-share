import { describe, expect, it } from 'vitest';
import { isFreeValue, hasCashback } from './u-card-filter';
import { U_CARDS } from '../data/u-cards';

describe('UCard fee and cashback filtering', () => {
  it('does not mistake numbers containing zero or negative wording for free', () => {
    for (const value of ['$10 或预存 $10', '$20/年', '$0.99/月', '美国Midnight实体制卡4.99美元，非虚拟免费报价']) {
      expect(isFreeValue(value), value).toBe(false);
    }
    for (const value of ['0', '$0', '0 USD', '0 月费、0 年费', '无年费', '虚拟卡免费']) {
      expect(isFreeValue(value), value).toBe(true);
    }
  });

  it('keeps fractional positive cashback and rejects zero and unknown values', () => {
    for (const value of ['0.5%', '0.05%', '10%', '最高 2%']) expect(hasCashback(value), value).toBe(true);
    for (const value of ['无', '0%', '0.0%', '待确认', '未公开']) expect(hasCashback(value), value).toBe(false);
  });

  it('classifies actual Plasma Lite and fractional cashback data correctly', () => {
    const lite = U_CARDS.find(card => card.slug === 'plasma-lite')!;
    expect(isFreeValue(lite.detail?.cardFee)).toBe(false);
    expect(U_CARDS.some(card => card.detail?.cashback === '0.5%' && hasCashback(card.detail.cashback))).toBe(true);
  });
});
