import React, { useState, useMemo, useEffect } from 'react';
import { UCardItem as UCardItemType } from '../../types/u-card';
import { UCardItem } from './UCardItem';
import { UiIcon } from '../awesome-ui/UiIcon';
import { isFreeValue, hasCashback } from '../../utils/u-card-filter';

interface UCardGridProps {
  cards: UCardItemType[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectCard: (card: UCardItemType) => void;
}

const CURATED_CARD_SLUGS = [
  'plasma-core',
  'plasma-lite',
  'plasma-platinum',
  'etherfi',
  'etherfi-luxe',
  'etherfi-pinnacle',
  'etherfi-vip',
  'bitget-wallet',
  'mexc',
  'kraken',
  'bybit',
  'tria',
  'tuyo',
];

const FEATURED_CARD_SLUGS = [
  'plasma-core',
  'etherfi',
  'bitget-wallet',
  'mexc',
  'kraken',
  'bybit',
  'tria',
  'infini-card',
  'starryblu-xingkong',
  'starryblu-zhushen',
  'starryblu-xingqiu',
  'tuyo',
];

const PAYMENTSCAN_CARD_SLUGS = [
  'redotpay',
  'kast',
  'etherfi',
  'plasma-core',
  'karta',
  'wirex-one',
  'kolo',
  'tria',
  'coca',
  'gnosispay',
  'bitget-wallet',
  'avici',
  'avalanche',
  'metamask',
  'tuyo',
  'exa',
  'ethena-pay',
  'solayer',
  'phantom-cash',
  'hyperbeat',
  'safepal',
  'cypher',
  'holyheld',
  'ready',
  'solflare',
];

export const UCardGrid: React.FC<UCardGridProps> = ({
  cards,
  searchQuery,
  onSearchChange,
  onSelectCard,
}) => {
  const [netFilter, setNetFilter] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Filter Form State
  const [annualFeeFree, setAnnualFeeFree] = useState(false);
  const [cardFeeFree, setCardFeeFree] = useState(false);
  const [cashbackOnly, setCashbackOnly] = useState(false);
  const [physicalCardFilter, setPhysicalCardFilter] = useState('');
  const [atmFilter, setAtmFilter] = useState('');

  // Platforms
  const [platformWechat, setPlatformWechat] = useState(false);
  const [platformAlipay, setPlatformAlipay] = useState(false);
  const [platformApplePay, setPlatformApplePay] = useState(false);
  const [platformGooglePay, setPlatformGooglePay] = useState(false);
  const [platformChatGPT, setPlatformChatGPT] = useState(false);
  const [platformClaude, setPlatformClaude] = useState(false);

  // KYC
  const [kycIdCard, setKycIdCard] = useState('');
  const [kycPassport, setKycPassport] = useState('');
  const [kycAddressProof, setKycAddressProof] = useState('');
  const [kycOverseasPhone, setKycOverseasPhone] = useState('');

  const sourceIndex = useMemo(() => new Map(cards.map((c, i) => [c, i])), [cards]);
  const firstIndexBySlug = useMemo(() => {
    const map = new Map<string, number>();
    cards.forEach((c, i) => {
      if (!map.has(c.slug)) map.set(c.slug, i);
    });
    return map;
  }, [cards]);

  const featuredRank = useMemo(
    () => new Map(FEATURED_CARD_SLUGS.map((slug, i) => [slug, i])),
    []
  );
  const paymentscanRank = useMemo(
    () => new Map(PAYMENTSCAN_CARD_SLUGS.map((slug, i) => [slug, i])),
    []
  );

  const sortCards = (list: UCardItemType[]) => {
    return [...list].sort((a, b) => {
      const aRank = featuredRank.has(a.slug) ? featuredRank.get(a.slug)! : 999;
      const bRank = featuredRank.has(b.slug) ? featuredRank.get(b.slug)! : 999;
      if (aRank !== bRank) return aRank - bRank;

      const aPs = paymentscanRank.has(a.slug) ? paymentscanRank.get(a.slug)! : 999;
      const bPs = paymentscanRank.has(b.slug) ? paymentscanRank.get(b.slug)! : 999;
      if (aPs !== bPs) return aPs - bPs;

      return (sourceIndex.get(a) || 0) - (sourceIndex.get(b) || 0);
    });
  };

  const supportsPlatform = (c: UCardItemType, platformName: string) => {
    return Boolean(
      c.detail &&
        c.detail.platforms &&
        c.detail.platforms.some(([p, s]) => p === platformName && s === 'supported')
    );
  };
  const getSpec = (c: UCardItemType, label: string) => {
    const specs = c.detail && c.detail.specs;
    if (!specs) return '';
    const row = specs.find(([name]) => String(name).includes(label));
    return row ? String(row[1]) : '';
  };
  const physicalCardStatus = (c: UCardItemType) => {
    const value = getSpec(c, '卡片形态');
    if (/实体卡/.test(value)) return '支持';
    if (/虚拟卡/.test(value)) return '不支持';
    const cautions = c.detail && c.detail.cautions ? c.detail.cautions.join(' ') : '';
    if (/仅虚拟卡|不提供实体卡/.test(cautions)) return '不支持';
    return '待确认';
  };
  const atmStatus = (c: UCardItemType) => {
    const value = getSpec(c, 'ATM');
    if (/不支持|不可|不能/.test(value)) return '不支持';
    if (/支持|可以|可取现/.test(value)) return '支持';
    const cautions = c.detail && c.detail.cautions ? c.detail.cautions.join(' ') : '';
    if (/不支持\s*ATM|ATM\s*不支持/.test(cautions)) return '不支持';
    return '待确认';
  };

  const selectedFilterCount = useMemo(() => {
    let count = 0;
    if (annualFeeFree) count++;
    if (cardFeeFree) count++;
    if (cashbackOnly) count++;
    if (physicalCardFilter) count++;
    if (atmFilter) count++;
    if (platformWechat) count++;
    if (platformAlipay) count++;
    if (platformApplePay) count++;
    if (platformGooglePay) count++;
    if (platformChatGPT) count++;
    if (platformClaude) count++;
    if (kycIdCard) count++;
    if (kycPassport) count++;
    if (kycAddressProof) count++;
    if (kycOverseasPhone) count++;
    return count;
  }, [
    annualFeeFree,
    cardFeeFree,
    cashbackOnly,
    physicalCardFilter,
    atmFilter,
    platformWechat,
    platformAlipay,
    platformApplePay,
    platformGooglePay,
    platformChatGPT,
    platformClaude,
    kycIdCard,
    kycPassport,
    kycAddressProof,
    kycOverseasPhone,
  ]);

  const resetAllFilters = () => {
    setAnnualFeeFree(false);
    setCardFeeFree(false);
    setCashbackOnly(false);
    setPhysicalCardFilter('');
    setAtmFilter('');
    setPlatformWechat(false);
    setPlatformAlipay(false);
    setPlatformApplePay(false);
    setPlatformGooglePay(false);
    setPlatformChatGPT(false);
    setPlatformClaude(false);
    setKycIdCard('');
    setKycPassport('');
    setKycAddressProof('');
    setKycOverseasPhone('');
    onSearchChange('');
    setNetFilter(null);
  };

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const result = cards.filter((c) => {
      if (q && !c.brand.toLowerCase().includes(q)) return false;
      if (netFilter === '精选' && (!CURATED_CARD_SLUGS.includes(c.slug) || firstIndexBySlug.get(c.slug) !== sourceIndex.get(c))) {
        return false;
      }
      if (netFilter === 'Visa' && c.net !== 'Visa') return false;
      if (netFilter === 'Mastercard' && c.net !== 'Mastercard') return false;

      if (annualFeeFree && !isFreeValue(c.detail && c.detail.annualFee)) return false;
      if (cardFeeFree && !isFreeValue(c.detail && c.detail.cardFee)) return false;
      if (cashbackOnly && !hasCashback(c.detail?.cashback)) return false;

      if (platformWechat && !supportsPlatform(c, '微信支付')) return false;
      if (platformAlipay && !supportsPlatform(c, '支付宝')) return false;
      if (platformApplePay && !supportsPlatform(c, 'Apple Pay')) return false;
      if (platformGooglePay && !supportsPlatform(c, 'Google Pay')) return false;
      if (platformChatGPT && !supportsPlatform(c, 'ChatGPT')) return false;
      if (platformClaude && !supportsPlatform(c, 'Claude')) return false;

      if (physicalCardFilter && physicalCardStatus(c) !== physicalCardFilter) return false;
      if (atmFilter && atmStatus(c) !== atmFilter) return false;

      const kyc = c.detail && c.detail.kycRequirements;
      if (kycIdCard && (!kyc || kyc.idCard !== kycIdCard)) return false;
      if (kycPassport && (!kyc || kyc.passport !== kycPassport)) return false;
      if (kycAddressProof && (!kyc || kyc.addressProof !== kycAddressProof)) return false;
      if (kycOverseasPhone && (!kyc || kyc.overseasPhone !== kycOverseasPhone)) return false;

      return true;
    });

    return sortCards(result);
  }, [
    cards,
    searchQuery,
    netFilter,
    annualFeeFree,
    cardFeeFree,
    cashbackOnly,
    platformWechat,
    platformAlipay,
    platformApplePay,
    platformGooglePay,
    platformChatGPT,
    platformClaude,
    physicalCardFilter,
    atmFilter,
    kycIdCard,
    kycPassport,
    kycAddressProof,
    kycOverseasPhone,
  ]);

  const INITIAL_BATCH = 48;
  const BATCH_STEP = 36;
  const [displayLimit, setDisplayLimit] = useState(INITIAL_BATCH);

  // Reset batch limit when search query or filter states change
  useEffect(() => {
    setDisplayLimit(INITIAL_BATCH);
  }, [
    searchQuery,
    netFilter,
    annualFeeFree,
    cardFeeFree,
    cashbackOnly,
    platformWechat,
    platformAlipay,
    platformApplePay,
    platformGooglePay,
    platformChatGPT,
    platformClaude,
    physicalCardFilter,
    atmFilter,
    kycIdCard,
    kycPassport,
    kycAddressProof,
    kycOverseasPhone,
  ]);

  const visibleCards = useMemo(() => {
    return filteredCards.slice(0, displayLimit);
  }, [filteredCards, displayLimit]);

  const toggleNet = (v: string) => {
    setNetFilter((prev) => (prev === v ? null : v));
  };

  return (
    <div>
      {/* Controls Bar */}
      <div className="controls">
        <label className="search">
          <UiIcon name="search" size={15} strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            placeholder="搜索卡片…"
            aria-label="搜索卡片"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </label>

        <button
          className={`pill ${netFilter === '精选' ? 'active' : ''}`}
          type="button"
          onClick={() => toggleNet('精选')}
        >
          精选
        </button>
        <button
          className={`pill ${netFilter === 'Visa' ? 'active' : ''}`}
          type="button"
          onClick={() => toggleNet('Visa')}
        >
          Visa
        </button>
        <button
          className={`pill ${netFilter === 'Mastercard' ? 'active' : ''}`}
          type="button"
          onClick={() => toggleNet('Mastercard')}
        >
          Mastercard
        </button>

        <button
          className="pill filter-trigger"
          type="button"
          aria-expanded={isFilterOpen}
          onClick={() => setIsFilterOpen(!isFilterOpen)}
        >
          <span>筛选</span>
          <span className="filter-count" hidden={selectedFilterCount === 0}>
            {selectedFilterCount}
          </span>
          <UiIcon name="chevron-down" size={12} strokeWidth={1.8} className="filter-chevron" aria-hidden="true" />
        </button>
      </div>

      {/* Expandable Filter Panel */}
      <div className="filter-panel" hidden={!isFilterOpen}>
        <div className="filter-body">
          <div className="filter-toolbar">
            <span className="filter-title">筛选条件</span>
            <button className="filter-reset" type="button" onClick={resetAllFilters}>
              重置全部
            </button>
          </div>

          <div className="filter-groups">
            <section className="filter-section">
              <p className="filter-label">费用与权益 <small>可多选</small></p>
              <div className="filter-chips">
                <label className="filter-check">
                  <input
                    type="checkbox"
                    checked={annualFeeFree}
                    onChange={(e) => setAnnualFeeFree(e.target.checked)}
                  />
                  无年费
                </label>
                <label className="filter-check">
                  <input
                    type="checkbox"
                    checked={cardFeeFree}
                    onChange={(e) => setCardFeeFree(e.target.checked)}
                  />
                  无开卡费
                </label>
                <label className="filter-check">
                  <input
                    type="checkbox"
                    checked={cashbackOnly}
                    onChange={(e) => setCashbackOnly(e.target.checked)}
                  />
                  有返现
                </label>
              </div>
            </section>

            <section className="filter-section">
              <p className="filter-label">卡片功能</p>
              <div className="filter-fields">
                <label className="filter-field">实体卡
                  <select
                    className="filter-select"
                    value={physicalCardFilter}
                    onChange={(e) => setPhysicalCardFilter(e.target.value)}
                  >
                    <option value="">不限</option>
                    <option value="支持">支持</option>
                    <option value="不支持">不支持</option>
                    <option value="待确认">待确认</option>
                  </select>
                </label>
                <label className="filter-field">ATM 取现
                  <select
                    className="filter-select"
                    value={atmFilter}
                    onChange={(e) => setAtmFilter(e.target.value)}
                  >
                    <option value="">不限</option>
                    <option value="支持">支持</option>
                    <option value="不支持">不支持</option>
                    <option value="待确认">待确认</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="filter-section filter-section--wide">
              <p className="filter-label">绑定与支付 <small>只统计明确支持</small></p>
              <div className="filter-chips">
                <label className="filter-check">
                  <input
                    type="checkbox"
                    checked={platformWechat}
                    onChange={(e) => setPlatformWechat(e.target.checked)}
                  />
                  微信支付
                </label>
                <label className="filter-check">
                  <input
                    type="checkbox"
                    checked={platformAlipay}
                    onChange={(e) => setPlatformAlipay(e.target.checked)}
                  />
                  支付宝
                </label>
                <label className="filter-check">
                  <input
                    type="checkbox"
                    checked={platformApplePay}
                    onChange={(e) => setPlatformApplePay(e.target.checked)}
                  />
                  Apple Pay
                </label>
                <label className="filter-check">
                  <input
                    type="checkbox"
                    checked={platformGooglePay}
                    onChange={(e) => setPlatformGooglePay(e.target.checked)}
                  />
                  Google Pay
                </label>
              </div>
            </section>

            <section className="filter-section filter-section--wide">
              <p className="filter-label">AI 应用支付 <small>只统计明确支持</small></p>
              <div className="filter-chips">
                <label className="filter-check">
                  <input
                    type="checkbox"
                    checked={platformChatGPT}
                    onChange={(e) => setPlatformChatGPT(e.target.checked)}
                  />
                  ChatGPT
                </label>
                <label className="filter-check">
                  <input
                    type="checkbox"
                    checked={platformClaude}
                    onChange={(e) => setPlatformClaude(e.target.checked)}
                  />
                  Claude
                </label>
              </div>
            </section>

            <section className="filter-section filter-section--wide">
              <p className="filter-label">KYC 申请材料</p>
              <div className="filter-fields kyc-fields">
                <label className="filter-field">身份证
                  <select
                    className="filter-select"
                    value={kycIdCard}
                    onChange={(e) => setKycIdCard(e.target.value)}
                  >
                    <option value="">不限</option>
                    <option value="需要">需要</option>
                    <option value="不需要">不需要</option>
                    <option value="待确认">待确认</option>
                  </select>
                </label>
                <label className="filter-field">护照
                  <select
                    className="filter-select"
                    value={kycPassport}
                    onChange={(e) => setKycPassport(e.target.value)}
                  >
                    <option value="">不限</option>
                    <option value="需要">需要</option>
                    <option value="不需要">不需要</option>
                    <option value="待确认">待确认</option>
                  </select>
                </label>
                <label className="filter-field">海外地址证明
                  <select
                    className="filter-select"
                    value={kycAddressProof}
                    onChange={(e) => setKycAddressProof(e.target.value)}
                  >
                    <option value="">不限</option>
                    <option value="需要">需要</option>
                    <option value="不需要">不需要</option>
                    <option value="待确认">待确认</option>
                  </select>
                </label>
                <label className="filter-field">海外手机号
                  <select
                    className="filter-select"
                    value={kycOverseasPhone}
                    onChange={(e) => setKycOverseasPhone(e.target.value)}
                  >
                    <option value="">不限</option>
                    <option value="需要">需要</option>
                    <option value="不需要">不需要</option>
                    <option value="待确认">待确认</option>
                  </select>
                </label>
              </div>
              <p className="filter-note">仅使用明确对应的同名卡资料；缺少资料不会被视为“不需要”。</p>
            </section>
          </div>
        </div>
      </div>

      {/* Card Count */}
      <p className="count">
        共 {filteredCards.length} 张卡
        {filteredCards.length > displayLimit && ` (已展示前 ${visibleCards.length} 张)`}
      </p>

      {/* Card Grid */}
      <div className="grid">
        {visibleCards.map((c) => (
          <UCardItem key={c.slug} card={c} onSelect={onSelectCard} />
        ))}
      </div>

      {/* Progressive Load More */}
      {filteredCards.length > displayLimit && (
        <div style={{ textAlign: 'center', marginTop: '2.5rem', marginBottom: '1.5rem' }}>
          <button
            type="button"
            className="pill"
            onClick={() => setDisplayLimit((prev) => prev + BATCH_STEP)}
            style={{
              margin: '0 auto',
              padding: '0 2.2rem',
              height: '2.8rem',
              fontSize: '0.92rem',
              gap: '0.6rem',
              boxShadow: '0 4px 14px oklch(0.24 0.008 80 / 0.08)'
            }}
          >
            <span>加载更多卡片 (余 {filteredCards.length - displayLimit} 张)</span>
            <UiIcon name="arrow-down" size={14} strokeWidth={2.2} />
          </button>
        </div>
      )}

      {/* Empty State Tip */}
      <p className="empty" style={{ display: filteredCards.length ? 'none' : 'block' }}>
        没有符合条件的卡片，换个关键词或筛选条件试试
      </p>
    </div>
  );
};
