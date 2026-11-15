import React, { useState, useMemo } from 'react';
import { PerkItem as PerkItemType } from '../../types/perk';
import { PerkItem } from './PerkItem';
import { UiIcon } from '../awesome-ui/UiIcon';

interface PerkGridProps {
  perks: PerkItemType[];
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  onSelectPerk: (perk: PerkItemType) => void;
}

export const PerkGrid: React.FC<PerkGridProps> = ({
  perks,
  searchQuery = '',
  onSearchChange,
  onSelectPerk,
}) => {
  const [selectedTag, setSelectedTag] = useState<string>('全部');

  const tags = ['全部', '永久云资源', '开发利器', '免费域名/网络', '出海金融', '免信用卡/极简'] as const;

  const filteredPerks = useMemo(() => {
    return perks.filter((p) => {
      // Tag filter
      if (selectedTag === '永久云资源' && p.category !== 'Cloud') return false;
      if (selectedTag === '开发利器' && p.category !== 'Dev') return false;
      if (selectedTag === '免费域名/网络' && p.category !== 'Domain') return false;
      if (selectedTag === '出海金融' && p.category !== 'Finance') return false;
      if (selectedTag === '免信用卡/极简' && (p.difficulty === '较高' || p.requirement.includes('信用卡'))) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchProvider = p.provider.toLowerCase().includes(q);
        const matchCategory = p.categoryName.toLowerCase().includes(q);
        const matchSummary = p.summary.toLowerCase().includes(q);
        const matchReq = p.requirement.toLowerCase().includes(q);
        const matchTags = p.tags.some((t) => t.toLowerCase().includes(q));
        const matchHighlights = p.highlights.some((h) => h.toLowerCase().includes(q));
        if (!matchName && !matchProvider && !matchCategory && !matchSummary && !matchReq && !matchTags && !matchHighlights) {
          return false;
        }
      }

      return true;
    });
  }, [perks, selectedTag, searchQuery]);

  return (
    <div>
      <div className="controls">
        <label className="search">
          <UiIcon name="search" size={15} strokeWidth={2} />
          <input
            type="search"
            placeholder="搜索福利名称、提供商、云资源、域名、开发者包…"
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

      <p className="count">共 {filteredPerks.length} 项出海与开发者核心免费福利 / 羊毛资源</p>

      {filteredPerks.length === 0 ? (
        <div className="empty">
          <p>没有匹配的福利资源，尝试更换搜索词或筛选标签。</p>
        </div>
      ) : (
        <div className="grid">
          {filteredPerks.map((perk) => (
            <PerkItem
              key={perk.id}
              perk={perk}
              onSelect={(p) => onSelectPerk(p)}
            />
          ))}
        </div>
      )}

    </div>
  );
};
