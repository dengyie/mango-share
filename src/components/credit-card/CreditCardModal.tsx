import React from 'react';
import { CreditCardItem } from '../../types/credit-card';
import { getCreditCardArt } from '../../utils/card-art';
import { useCopyFeedback } from '../../utils/use-copy-feedback';
import { useModalLock } from '../../utils/use-modal-lock';
import { ItemMarkControl } from '../account/ItemMarkControl';
import { UiIcon } from '../awesome-ui/UiIcon';

interface CreditCardModalProps {
  card: CreditCardItem | null;
  onClose: () => void;
}

export const CreditCardModal: React.FC<CreditCardModalProps> = ({ card, onClose }) => {
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
    const shareUrl = `${origin}#/credit-cards?card=${card.id}`;
    await copyShare(shareUrl, true);
  };

  const cardArt = getCreditCardArt(
    card.id,
    card.name,
    card.issuer,
    card.network,
    card.regionName,
    card.cardBgColor,
    card.cardTextColor
  );

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
            <span>返回信用卡列表</span>
          </button>
        </div>

        {/* Hero Card Image with Glare */}
        <div className="hero-card" onPointerMove={handlePointerMove}>
          <img src={cardArt} alt={`${card.name} 卡面`} />
        </div>

        <div className="card-title">{card.name.split(' (')[0]}</div>
        <div className="card-brand">{card.issuer} · {card.regionName} ({card.currency}) · {card.network}</div>

        {/* 3-Column Key Stats */}
        <div className="stats-detail">
          <div className="stat-detail-item">
            <span className="stat-detail-value">{card.annualFee.split(' (')[0]}</span>
            <span className="stat-detail-label">年费</span>
          </div>
          <div className="stat-detail-item">
            <span className="stat-detail-value">{card.foreignTxFee}</span>
            <span className="stat-detail-label">外币手续费</span>
          </div>
          <div className="stat-detail-item">
            <span className="stat-detail-value">{card.creditScoreLevel === 'None' ? '免信用' : `${card.creditScoreLevel}信用`}</span>
            <span className="stat-detail-label">信用门槛</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="cta-row">
          {card.applyUrl && (
            <a
              href={card.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="apply-btn"
            >
              <span>前往官方申请/查阅</span>
              <UiIcon name="external-link" size={13} strokeWidth={2.2} />
            </a>
          )}

          {card.affCode && (
            <button
              type="button"
              className={`invite-pill ${copied ? 'copied' : ''}`}
              onClick={() => handleCopyCode(card.affCode || '')}
            >
              <span>推荐码: <strong>{card.affCode}</strong></span>
              <UiIcon name={copied ? "check" : "copy"} size={14} strokeWidth={2} style={{ color: copied ? '#10b981' : 'inherit' }} />
            </button>
          )}

          <button
            type="button"
            className={`share-pill ${shareCopied ? 'copied' : ''}`}
            onClick={handleCopyShareLink}
            title="复制此信用卡直达分享链接"
          >
            <UiIcon name={shareCopied ? "check" : "link"} size={13} strokeWidth={2.2} />
            <span>{shareCopied ? '已复制直达链接' : '分享此卡'}</span>
          </button>
        </div>

        {/* 我的标记（已开通 / 待开通） */}
        <ItemMarkControl itemType="credit-card" itemId={card.id} />

        {/* Welcome Bonus & Cashback */}
        <div className="section-head">
          <UiIcon name="star" size={14} strokeWidth={2} />
          <span>开卡礼与返现回报</span>
        </div>
        <div style={{ background: 'var(--paper-soft)', border: '1px solid var(--line)', borderRadius: '12px', padding: '0.85rem 1rem', marginBottom: '1.2rem', fontSize: '0.85rem', lineHeight: '1.6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
            <UiIcon name="gift" size={15} style={{ color: 'var(--ink)', flexShrink: 0 }} />
            <strong style={{ color: 'var(--ink)' }}>开卡迎新奖励：</strong>
            <span style={{ color: 'var(--ink-soft)' }}>{card.welcomeBonus}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <UiIcon name="coins" size={15} style={{ color: 'var(--ink)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--ink)' }}>返点/返现机制：</strong>
              <span style={{ color: 'var(--ink-soft)' }}>{card.cashbackRewards}</span>
            </div>
          </div>
        </div>

        {/* Requirements */}
        <div className="section-head">
          <UiIcon name="lock" size={14} strokeWidth={2} />
          <span>申请门槛与条件</span>
        </div>
        <div style={{ background: 'var(--paper-soft)', border: '1px solid var(--line)', borderRadius: '12px', padding: '0.75rem 1rem', marginBottom: '1.2rem', fontSize: '0.85rem', color: 'var(--ink-soft)', lineHeight: '1.5' }}>
          {card.requirement}
        </div>

        {/* Features list */}
        <div className="section-head">
          <UiIcon name="check" size={14} strokeWidth={2} />
          <span>核心权益特色</span>
        </div>
        <ul className="features-list">
          {card.features.map((f, idx) => (
            <li key={idx}>
              <span className="bullet" style={{ display: 'inline-flex', alignItems: 'center', marginRight: '6px' }}>
                <UiIcon name="check" size={13} style={{ color: 'var(--gold, #d97706)' }} />
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {/* Cautions */}
        {card.cautions && card.cautions.length > 0 && (
          <>
            <div className="section-head">
              <UiIcon name="alert-triangle" size={14} strokeWidth={2} style={{ color: '#ef4444' }} />
              <span>注意事项与避坑指南</span>
            </div>
            <ul className="features-list" style={{ color: 'var(--ink-soft)' }}>
              {card.cautions.map((c, idx) => (
                <li key={idx}>
                  <span className="bullet" style={{ display: 'inline-flex', alignItems: 'center', marginRight: '6px' }}>
                    <UiIcon name="alert-triangle" size={13} style={{ color: 'var(--warn-ink, #f59e0b)' }} />
                  </span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="meta-footer">
          数据采集自发卡机构官网与公开条款，政策可能随时间调整，开卡前请以发卡行官方披露为准。
        </div>
      </div>
    </div>
  );
};
