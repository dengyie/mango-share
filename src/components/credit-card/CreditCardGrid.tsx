import React, { useState, useMemo } from 'react';
import { CreditCardItem as CreditCardItemType } from '../../types/credit-card';
import { CreditCardItem } from './CreditCardItem';
import { UiIcon } from '../awesome-ui/UiIcon';

interface CreditCardGridProps {
  cards: CreditCardItemType[];
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  onSelectCard: (card: CreditCardItemType) => void;
}

export const CreditCardGrid: React.FC<CreditCardGridProps> = ({
  cards,
  searchQuery = '',
  onSearchChange,
  onSelectCard,
}) => {
  const [selectedTag, setSelectedTag] = useState<string>('全部');

  const tags = ['全部', '美国', '香港', '新加坡', '免年费', '0% FTF', '新手/护照可办'] as const;

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      // Tag filter
      if (selectedTag === '美国' && card.region !== 'US') return false;
      if (selectedTag === '香港' && card.region !== 'HK') return false;
      if (selectedTag === '新加坡' && card.region !== 'SG') return false;
      if (selectedTag === '免年费' && !card.annualFee.includes('$0')) return false;
      if (selectedTag === '0% FTF' && !card.foreignTxFee.startsWith('0%')) return false;
      if (selectedTag === '新手/护照可办' && card.creditScoreLevel === 'High') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = card.name.toLowerCase().includes(q);
        const matchIssuer = card.issuer.toLowerCase().includes(q);
        const matchRegion = card.regionName.toLowerCase().includes(q);
        const matchSummary = card.summary.toLowerCase().includes(q);
        const matchReq = card.requirement.toLowerCase().includes(q);
        const matchFeatures = card.features.some((f) => f.toLowerCase().includes(q));
        if (!matchName && !matchIssuer && !matchRegion && !matchSummary && !matchReq && !matchFeatures) {
          return false;
        }
      }

      return true;
    });
  }, [cards, selectedTag, searchQuery]);

  return (
    <div>
      <div className="controls">
        <label className="search">
          <UiIcon name="search" size={15} strokeWidth={2} />
          <input
            type="search"
            placeholder="搜索信用卡名称、发卡行、地区、返现权益…"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </label>

        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            className={`pill ${selectedTag === tag ? 'active' : ''}`}
            onClick={() => setSelectedTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      <p className="count">共 {filteredCards.length} 张全球主流信用卡 / 离岸借记账户</p>

      {filteredCards.length === 0 ? (
        <div className="empty">
          <p>没有匹配的信用卡，尝试更换搜索词或筛选标签。</p>
        </div>
      ) : (
        <div className="grid">
          {filteredCards.map((card) => (
            <CreditCardItem
              key={card.id}
              card={card}
              onSelect={(c) => onSelectCard(c)}
            />
          ))}
        </div>
      )}

    </div>
  );
};
