import React from 'react';
import { SimCardItem } from '../../types/sim-card';
import { getSimCardArt } from '../../utils/card-art';
import { useCopyFeedback } from '../../utils/use-copy-feedback';
import { useModalLock } from '../../utils/use-modal-lock';
import { ItemMarkControl } from '../account/ItemMarkControl';
import { UiIcon } from '../awesome-ui/UiIcon';

interface SimCardModalProps {
  card: SimCardItem | null;
  onClose: () => void;
}

export const SimCardModal: React.FC<SimCardModalProps> = ({ card, onClose }) => {
  const [copied, copyCode] = useCopyFeedback<boolean>(card?.id ?? null);
  const [shareCopied, copyShare] = useCopyFeedback<boolean>(card?.id ?? null);
  useModalLock(Boolean(card), onClose);

  if (!card) return null;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  const handleCopyCode = async (code: string) => {
    await copyCode(code, true);
  };

  const handleCopyShareLink = async () => {
    const origin = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://share.mangoqwq.com/';
    const shareUrl = `${origin}#/sim-cards?card=${card.id}`;
    await copyShare(shareUrl, true);
  };

  const cardArt = getSimCardArt(card.id, card.name, card.countryCode, card.country, card.form);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="topbar">
          <button className="back-btn" onClick={onClose} type="button">
            <UiIcon name="arrow-left" size={14} strokeWidth={2.2} />
            <span>返回电话卡列表</span>
          </button>
        </div>

        {/* Hero Card Image with Glare */}
        <div className="hero-card" onPointerMove={handlePointerMove}>
          <img src={cardArt} alt={`${card.name} 卡面`} />
        </div>

        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--paper-soft)', border: '1px solid var(--line)', color: 'var(--ink-soft)' }}>
            {card.countryCode}
          </span>
          <span>{card.name.split(' (')[0]}</span>
        </div>
        <div className="card-brand">{card.country} · {card.form.join(' / ')} 全球漫游通信卡</div>

        {/* 3-Column Key Stats */}
        <div className="stats-detail">
          <div className="stat-detail-item">
            <span className="stat-detail-value">{card.maintenanceCost.split('(')[0].trim()}</span>
            <span className="stat-detail-label">保号成本</span>
          </div>
          <div className="stat-detail-item">
            <span className="stat-detail-value">{card.receiveSmsCost}</span>
            <span className="stat-detail-label">接短信资费</span>
          </div>
          <div className="stat-detail-item">
            <span className="stat-detail-value">{card.needRealName ? '需实名' : '免实名'}</span>
            <span className="stat-detail-label">实名登记</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="cta-row">
          {card.affLink && (
            <a
              href={card.affLink}
              target="_blank"
              rel="noopener noreferrer"
              className="apply-btn"
            >
              <span>官方申请/购买</span>
              <UiIcon name="external-link" size={13} strokeWidth={2.2} />
            </a>
          )}

          {card.affCode && (
            <button
              type="button"
              className={`invite-pill ${copied ? 'copied' : ''}`}
              onClick={() => handleCopyCode(card.affCode || '')}
            >
              <span>优惠/奖励码: <strong>{card.affCode}</strong></span>
              <UiIcon name={copied ? "check" : "copy"} size={14} strokeWidth={2} style={{ color: copied ? '#10b981' : 'inherit' }} />
              <span style={{ fontSize: '0.74rem', color: copied ? '#10b981' : 'inherit' }}>
                {copied ? '已复制' : '复制'}
              </span>
            </button>
          )}

          <button
            type="button"
            className={`share-pill ${shareCopied ? 'copied' : ''}`}
            onClick={handleCopyShareLink}
            title="复制此电话卡直达分享链接"
          >
            <UiIcon name={shareCopied ? "check" : "link"} size={13} strokeWidth={2.2} />
            <span>{shareCopied ? '已复制直达链接' : '分享此卡'}</span>
          </button>
        </div>

        {/* 我的标记（已开通 / 待开通） */}
        <ItemMarkControl itemType="sim-card" itemId={card.id} />

        {/* Tags */}
        {card.tags && card.tags.length > 0 && (
          <div className="filter-chips" style={{ marginBottom: '1.2rem' }}>
            {card.tags.map((t) => (
              <span key={t} className="plat" style={{ fontSize: '0.76rem', padding: '0.2rem 0.65rem' }}>
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Basic Specs */}
        <div>
          <div className="section-label">基本信息</div>
          <div className="specs-list">
            <div className="spec-row">
              <span className="spec-label">支持卡型</span>
              <span className="spec-val">{card.form.join(' / ')}</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">保号周期细则</span>
              <span className="spec-val">{card.maintenanceCost}</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">实名认证方式</span>
              <span className="spec-val">{card.realNameDesc || (card.needRealName ? '需线上实名' : '免实名')}</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">充值方式</span>
              <span className="spec-val">{card.topUpMethods.join(' / ')}</span>
            </div>
          </div>
        </div>

        {/* Core Features */}
        {card.features && card.features.length > 0 && (
          <div>
            <div className="section-label">卡片亮点</div>
            <ul className="bullets">
              {card.features.map((f, idx) => (
                <li key={idx}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Cautions */}
        {card.cautions && card.cautions.length > 0 && (
          <div>
            <div className="section-label">避坑与使用须知</div>
            <ul className="bullets warn">
              {card.cautions.map((c, idx) => (
                <li key={idx}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
