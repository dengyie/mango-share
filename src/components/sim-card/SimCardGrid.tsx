import React, { useState, useMemo } from 'react';
import { SimCardItem as SimCardItemType } from '../../types/sim-card';
import { SimCardItem } from './SimCardItem';
import { UiIcon } from '../awesome-ui/UiIcon';

interface SimCardGridProps {
  cards: SimCardItemType[];
  searchQuery: string;
  onSearchChange?: (q: string) => void;
  onSelectCard: (card: SimCardItemType) => void;
}

export const SimCardGrid: React.FC<SimCardGridProps> = ({
  cards,
  searchQuery,
  onSearchChange,
  onSelectCard,
}) => {
  const [selectedTag, setSelectedTag] = useState<string>('全部');

  const filteredCards = useMemo(() => {
    let result = cards;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.country.toLowerCase().includes(q) ||
          c.summary.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (selectedTag === '免实名') {
      result = result.filter((c) => !c.needRealName);
    } else if (selectedTag === 'eSIM') {
      result = result.filter((c) => c.form.includes('eSIM') || c.form.includes('Dual'));
    } else if (selectedTag === '零月租') {
      result = result.filter(
        (c) =>
          c.maintenanceCost.includes('0') ||
          c.maintenanceCost.includes('免费') ||
          c.maintenanceCost.includes('极低')
      );
    } else if (selectedTag !== '全部') {
      result = result.filter((c) => c.country.includes(selectedTag));
    }

    return result;
  }, [cards, searchQuery, selectedTag]);

  return (
    <div>
      {/* Controls Bar */}
      <div className="controls">
        <label className="search">
          <UiIcon name="search" size={15} strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            placeholder="搜索电话卡、地区、运营商…"
            aria-label="搜索电话卡"
            value={searchQuery}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          />
        </label>

        {(['全部', '免实名', 'eSIM', '零月租', '英国', '香港', '美国', '新西兰'] as const).map((tag) => (
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

      {/* Card Count */}
      <p className="count">共 {filteredCards.length} 款海外电话卡 / eSIM 芯片</p>

      {/* Card Grid */}
      <div className="grid">
        {filteredCards.map((card) => (
          <SimCardItem
            key={card.id}
            card={card}
            onSelect={(c) => onSelectCard(c)}
          />
        ))}
      </div>

      {/* Empty State Tip */}
      <p className="empty" style={{ display: filteredCards.length ? 'none' : 'block' }}>
        没有符合条件的电话卡，换个关键词或筛选标签试试
      </p>

    </div>
  );
};
