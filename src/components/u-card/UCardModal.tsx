import React from 'react';
import { UCardItem } from '../../types/u-card';
import { useCopyFeedback } from '../../utils/use-copy-feedback';
import { useModalLock } from '../../utils/use-modal-lock';
import { ItemMarkControl } from '../account/ItemMarkControl';
import { UiIcon } from '../awesome-ui/UiIcon';

interface UCardModalProps {
  card: UCardItem | null;
  onClose: () => void;
  allCards: UCardItem[];
  onSelectVariant: (slug: string) => void;
}

export const UCardModal: React.FC<UCardModalProps> = ({
  card,
  onClose,
  allCards,
  onSelectVariant,
}) => {
  const [copied, copyCode] = useCopyFeedback<boolean>(card?.slug ?? null);
  const [shareCopied, copyShare] = useCopyFeedback<boolean>(card?.slug ?? null);
  useModalLock(Boolean(card), onClose);

  if (!card) return null;

  const { detail, brand, net, tags, variantGroup } = card;

  // Find other variants if card belongs to a variant group
  const variants = variantGroup
    ? allCards.filter((c) => c.variantGroup === variantGroup)
    : [];

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
    const shareUrl = `${origin}#/u-cards?card=${card.slug}`;
    await copyShare(shareUrl, true);
  };

  const inviteCode = detail.inviteCode;
  const applyUrl = detail.applyUrl || detail.officialUrl || '#';

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
            <span>返回卡片列表</span>
          </button>
        </div>

        {/* Hero Card Image with Glare */}
        <div className="hero-card" onPointerMove={handlePointerMove}>
          <img src={card.img.startsWith('/') ? card.img : `/${card.img}`} alt={`${brand} 卡面`} />
        </div>

        <div className="card-title">{brand}</div>
        <div className="card-brand">{detail.name || `${net} 加密货币卡`}</div>

        {/* 3-Column Key Stats */}
        <div className="stats-detail">
          <div className="stat-detail-item">
            <span className="stat-detail-value">{detail.annualFee || '免费'}</span>
            <span className="stat-detail-label">年费</span>
          </div>
          <div className="stat-detail-item">
            <span className="stat-detail-value">{detail.depositFee || '0%'}</span>
            <span className="stat-detail-label">充值费</span>
          </div>
          <div className="stat-detail-item">
            <span className="stat-detail-value">{detail.cardFee || '免费'}</span>
            <span className="stat-detail-label">虚拟卡费</span>
          </div>
        </div>

        {/* Status / Warning Banner */}
        {detail.statusNote && (
          <div className="status-banner">{detail.statusNote}</div>
        )}

        {/* CTA Buttons */}
        <div className="cta-row">
          {applyUrl !== '#' && (
            <a
              href={applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="apply-btn"
            >
              <span>立即申请</span>
              <UiIcon name="external-link" size={13} strokeWidth={2.2} />
            </a>
          )}

          {inviteCode && (
            <button
              type="button"
              className={`invite-pill ${copied ? 'copied' : ''}`}
              onClick={() => handleCopyCode(inviteCode)}
            >
              <span>邀请码: <strong>{inviteCode}</strong></span>
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
            title="复制此卡片直达分享链接"
          >
            <UiIcon name={shareCopied ? "check" : "link"} size={13} strokeWidth={2.2} />
            <span>{shareCopied ? '已复制直达链接' : '分享此卡'}</span>
          </button>
        </div>

        {/* 我的标记（已开通 / 待开通） */}
        <ItemMarkControl itemType="u-card" itemId={card.slug} />

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="filter-chips" style={{ marginBottom: '1.2rem' }}>
            {tags.map((t) => (
              <span key={t} className="plat" style={{ fontSize: '0.76rem', padding: '0.2rem 0.65rem' }}>
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Variant Switcher */}
        {variants.length > 1 && (
          <div className="variant-switch" style={{ borderTop: '1px solid var(--line)', paddingTop: '1rem', marginTop: '1rem' }}>
            <div className="section-label" style={{ margin: '0 0 0.55rem' }}>同系列版本</div>
            <div className="variant-options">
              {variants.map((v) => (
                <div
                  key={v.slug}
                  className={`variant-option ${v.slug === card.slug ? 'active' : ''}`}
                  onClick={() => onSelectVariant(v.slug)}
                  style={{ cursor: 'pointer' }}
                >
                  <img src={v.img.startsWith('/') ? v.img : `/${v.img}`} alt={v.brand} />
                  <span className="variant-name">{v.variantLabel || v.brand}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Basic Specs */}
        {detail.specs && detail.specs.length > 0 && (
          <div>
            <div className="section-label">基本信息</div>
            <div className="specs-list">
              {detail.specs.map(([k, v], idx) => (
                <div key={idx} className="spec-row">
                  <span className="spec-label">{k}</span>
                  <span className="spec-val">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Platforms Support */}
        {detail.platforms && detail.platforms.length > 0 && (
          <div>
            <div className="section-label">绑定与支持</div>
            <div className="plats">
              {detail.platforms.map(([pName, pStatus], idx) => (
                <span key={idx} className={`plat ${pStatus}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span className="mark" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {pStatus === 'supported' ? (
                      <UiIcon name="check" size={12} />
                    ) : pStatus === 'conditional' ? (
                      <UiIcon name="alert-triangle" size={12} />
                    ) : (
                      <UiIcon name="x" size={12} />
                    )}
                  </span>
                  <span>{pName}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* KYC Requirements */}
        {detail.kycRequirements && (
          <div>
            <div className="section-label">申请材料 (KYC)</div>
            <div className="kyc-grid">
              <div className="kyc-item">
                <span className="kyc-key">身份证</span>
                <span>{detail.kycRequirements.idCard}</span>
              </div>
              <div className="kyc-item">
                <span className="kyc-key">护照</span>
                <span>{detail.kycRequirements.passport}</span>
              </div>
              <div className="kyc-item">
                <span className="kyc-key">海外地址证明</span>
                <span>{detail.kycRequirements.addressProof}</span>
              </div>
              <div className="kyc-item">
                <span className="kyc-key">海外手机号</span>
                <span>{detail.kycRequirements.overseasPhone}</span>
              </div>
            </div>
          </div>
        )}

        {/* Cautions / Bullets */}
        {detail.cautions && detail.cautions.length > 0 && (
          <div>
            <div className="section-label">避坑与使用须知</div>
            <ul className="bullets warn">
              {detail.cautions.map((c, idx) => (
                <li key={idx}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
