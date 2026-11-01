import React from 'react';
import { AiStationItem as AiStationItemType } from '../../types/ai-station';
import { getAiStationArt, getStationHost, AiStationCardHealth } from '../../utils/card-art';
import { ItemStatusBadge } from '../account/ItemMarkControl';

interface AiStationItemProps {
  station: AiStationItemType;
  onSelect: (station: AiStationItemType) => void;
}

const AiStationItemInner: React.FC<AiStationItemProps> = ({ station, onSelect }) => {
  // A backend test result is historical; it is not a live health check.
  const backendLatency =
    typeof station.responseTime === 'number' && station.responseTime > 0
      ? station.responseTime
      : null;
  const handlePointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  // A no-cors response is opaque and cannot establish upstream health.
  // Backend measurements are historical, not proof of current availability.
  const cardHealth: AiStationCardHealth = 'unknown';
  const cardArt = getAiStationArt(station.id, station.name, station.category, station.models, station.portalUrl, cardHealth);
  const hostLabel = getStationHost(station);
  const statusText = backendLatency !== null ? `上次测试 ${backendLatency}ms` : '状态未知';
  const statusColor = '#9ca3af';

  return (
    <div
      className="cell"
      onClick={() => onSelect(station)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(station);
        }
      }}
    >
      <span className="cell-img" onPointerMove={handlePointerMove}>
        <img src={cardArt} alt={`${station.name} 卡面`} loading="lazy" />
        {!station.id.startsWith('upstream-') && (
          <ItemStatusBadge itemType="ai-station" itemId={station.id} />
        )}
      </span>
      <span className="cell-meta">
        <div className="cell-name">
          <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.9rem' }}>{hostLabel}</span>
        </div>
        <div className="cell-sub" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusColor, display: 'inline-block' }} />
            <span>{statusText}</span>
          </span>
          <span>·</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {station.quotaDesc.split('(')[0].trim()}
          </span>
        </div>
      </span>
    </div>
  );
};

// Memo boundary: the grid renders ~170 cards, and every probe resolution or
// search keystroke would otherwise re-render (and re-generate the base64 SVG
// card art of) every surviving card. Props are the station object (stable
// reference from the grid's useMemo) plus the select callback.
export const AiStationItem = React.memo(AiStationItemInner);
