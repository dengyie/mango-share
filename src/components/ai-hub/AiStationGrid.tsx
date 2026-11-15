import React, { useMemo, useState } from 'react';
import { AiStationItem as AiStationItemType } from '../../types/ai-station';
import { AiStationItem } from './AiStationItem';
import { UiIcon } from '../awesome-ui/UiIcon';

interface AiStationGridProps {
  stations: AiStationItemType[];
  /** Channels that arrived from the API station backend. */
  channelCount: number;
  /** Unique upstream origins represented in the grid. */
  upstreamCount: number;
  apiEndpoint: string;
  apiModelCount: number;
  searchQuery: string;
  onSearchChange?: (q: string) => void;
  onSelectStation: (station: AiStationItemType) => void;
}

/**
 * Presentational grid for the ai-hub tab. Data (merged presets + live
 * backend topology) and admin state live in App via useAiHubData; this
 * component only filters and renders. All management surfaces belong to
 * the 用户 tab and are intentionally not reachable from here.
 */
export const AiStationGrid: React.FC<AiStationGridProps> = ({
  stations,
  channelCount,
  upstreamCount,
  apiEndpoint,
  apiModelCount,
  searchQuery,
  onSearchChange,
  onSelectStation,
}) => {
  const [selectedTag, setSelectedTag] = useState<string>('全部');

  const filteredStations = useMemo(() => {
    let result = stations;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.category?.toLowerCase().includes(q) ||
          s.models?.some((m) => m.toLowerCase().includes(q)) ||
          s.tags?.some((t) => t.toLowerCase().includes(q)) ||
          s.quotaDesc?.toLowerCase().includes(q)
      );
    }

    if (selectedTag === 'NewAPI') {
      result = result.filter((s) => s.category === 'NewAPI');
    } else if (selectedTag === '网关') {
      result = result.filter((s) => s.category === 'Gateway');
    } else if (selectedTag === 'Linux.do') {
      result = result.filter((s) => s.authType === 'LinuxDO');
    } else if (selectedTag === 'Claude') {
      result = result.filter((s) => s.models?.some((m) => m.toLowerCase().includes('claude')));
    } else if (selectedTag === 'DeepSeek') {
      result = result.filter((s) => s.models?.some((m) => m.toLowerCase().includes('deepseek')));
    } else if (selectedTag === 'GPT') {
      result = result.filter((s) => s.models?.some((m) => m.toLowerCase().startsWith('gpt')));
    } else if (selectedTag === '免费Key') {
      result = result.filter((s) => s.category === 'DirectKey');
    } else if (selectedTag === '推荐主力') {
      result = result.filter((s) => s.id === 'yiming' || s.id === 'amnew' || s.id === 'emrank');
    }

    return result;
  }, [stations, searchQuery, selectedTag]);

  return (
    <div>
      {/* Controls Bar */}
      <div className="controls">
        <label className="search">
          <UiIcon name="search" size={15} strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            placeholder="搜索 AI 站点名称、支持模型、协议…"
            aria-label="搜索 AI 站点"
            value={searchQuery}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          />
        </label>

        {(['全部', '推荐主力', 'NewAPI', '网关', 'Linux.do', 'Claude', 'DeepSeek', 'GPT', '免费Key'] as const).map((tag) => (
          <button
            key={tag}
            type="button"
            className={`pill ${selectedTag === tag ? 'active' : ''}`}
            onClick={() => setSelectedTag(tag)}
          >
            {tag === '推荐主力' && <UiIcon name="star" size={11} className="mr-1 inline text-amber-500" />}
            {tag}
          </button>
        ))}
      </div>

      {/* Card Count & Match Info */}
      <div className="count flex flex-wrap items-center justify-between gap-2">
        <span>
          共 {filteredStations.length} 个活跃公益站 / 自建中转节点
          {channelCount > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 rounded border border-[var(--line)] bg-[var(--paper-soft)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--ink-soft)]">
              实时下发 {channelCount} 渠道 · {upstreamCount} 上游
            </span>
          )}
        </span>
        {apiModelCount > 0 && (
          <span className="text-xs text-[var(--ink-soft)]">
            已与 <strong className="text-[var(--ink)]">{apiEndpoint}</strong> ({apiModelCount} 款模型) 形成拓扑匹配
          </span>
        )}
      </div>

      {/* Card Grid */}
      <div className="grid">
        {filteredStations.map((station) => (
          <AiStationItem
            key={station.id}
            station={station}
            onSelect={(s) => onSelectStation(s)}
          />
        ))}
      </div>

      {/* Empty State Tip */}
      <p className="empty" style={{ display: filteredStations.length ? 'none' : 'block' }}>
        没有符合条件的 AI 公益站节点，换个关键词或筛选标签试试
      </p>

    </div>
  );
};
