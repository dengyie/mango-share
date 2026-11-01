import React from 'react';
import { PerkItem } from '../../types/perk';
import { getPerkArt } from '../../utils/card-art';
import { useCopyFeedback } from '../../utils/use-copy-feedback';
import { useModalLock } from '../../utils/use-modal-lock';
import { ItemMarkControl } from '../account/ItemMarkControl';
import { UiIcon } from '../awesome-ui/UiIcon';

interface PerkModalProps {
  perk: PerkItem | null;
  onClose: () => void;
}

export const PerkModal: React.FC<PerkModalProps> = ({ perk, onClose }) => {
  const [shareCopied, copyShare] = useCopyFeedback<boolean>(perk?.id ?? null);
  useModalLock(Boolean(perk), onClose);

  if (!perk) return null;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  const handleCopyShareLink = async () => {
    const origin = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://share.mangoqwq.com/';
    const shareUrl = `${origin}#/perks?card=${perk.id}`;
    await copyShare(shareUrl, true);
  };

  const cardArt = getPerkArt(
    perk.id,
    perk.name,
    perk.categoryName,
    perk.provider,
    perk.rewardValue,
    perk.iconName
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
            <span>返回羊毛福利列表</span>
          </button>
        </div>

        {/* Hero Card Image with Glare */}
        <div className="hero-card" onPointerMove={handlePointerMove}>
          <img src={cardArt} alt={`${perk.name} 卡面`} />
        </div>

        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UiIcon name={perk.iconName || 'gift'} size={20} style={{ opacity: 0.9, flexShrink: 0 }} />
          <span>{perk.name.split(' (')[0]}</span>
        </div>
        <div className="card-brand">{perk.provider} · {perk.categoryName}</div>

        {/* 3-Column Key Stats */}
        <div className="stats-detail">
          <div className="stat-detail-item">
            <span className="stat-detail-value">{perk.difficulty}难度</span>
            <span className="stat-detail-label">获取门槛</span>
          </div>
          <div className="stat-detail-item">
            <span className="stat-detail-value">{perk.validity.split(' (')[0]}</span>
            <span className="stat-detail-label">有效周期</span>
          </div>
          <div className="stat-detail-item">
            <span className="stat-detail-value">{perk.categoryName}</span>
            <span className="stat-detail-label">福利分类</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="cta-row">
          <a
            href={perk.targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="apply-btn"
          >
            <span>前往官方领取 / 注册直达</span>
            <UiIcon name="external-link" size={13} strokeWidth={2.2} />
          </a>

          <button
            type="button"
            className={`share-pill ${shareCopied ? 'copied' : ''}`}
            onClick={handleCopyShareLink}
            title="复制此福利直达分享链接"
          >
            <UiIcon name={shareCopied ? "check" : "link"} size={13} strokeWidth={2.2} />
            <span>{shareCopied ? '已复制直达链接' : '分享福利'}</span>
          </button>
        </div>

        {/* 我的标记（已开通 / 待开通） */}
        <ItemMarkControl itemType="perk" itemId={perk.id} />

        {/* Summary & Value Quote */}
        <div style={{ background: 'var(--paper-soft)', border: '1px solid var(--line)', borderRadius: '12px', padding: '0.85rem 1rem', marginBottom: '1.2rem', fontSize: '0.85rem', lineHeight: '1.6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
            <UiIcon name="gift" size={15} style={{ color: 'var(--ink)', flexShrink: 0 }} />
            <strong style={{ color: 'var(--ink)' }}>预估价值：</strong>
            <span style={{ color: '#0284c7', fontWeight: 600 }}>{perk.rewardValue}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <UiIcon name="lightbulb" size={15} style={{ color: 'var(--ink)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--ink)' }}>核心亮点：</strong>
              <span style={{ color: 'var(--ink-soft)' }}>{perk.summary}</span>
            </div>
          </div>
        </div>

        {/* Requirement */}
        <div className="section-head">
          <UiIcon name="lock" size={14} strokeWidth={2} />
          <span>申请前置条件</span>
        </div>
        <div style={{ background: 'var(--paper-soft)', border: '1px solid var(--line)', borderRadius: '12px', padding: '0.75rem 1rem', marginBottom: '1.2rem', fontSize: '0.85rem', color: 'var(--ink-soft)', lineHeight: '1.5' }}>
          {perk.requirement}
        </div>

        {/* Highlights List */}
        <div className="section-head">
          <UiIcon name="check" size={14} strokeWidth={2} />
          <span>涵盖福利清单</span>
        </div>
        <ul className="features-list">
          {perk.highlights.map((h, idx) => (
            <li key={idx}>
              <span className="bullet" style={{ display: 'inline-flex', alignItems: 'center', marginRight: '6px' }}>
                <UiIcon name="check" size={13} style={{ color: 'var(--gold, #d97706)' }} />
              </span>
              <span>{h}</span>
            </li>
          ))}
        </ul>

        {/* Practical Steps */}
        {perk.steps && perk.steps.length > 0 && (
          <>
            <div className="section-head">
              <UiIcon name="clock" size={14} strokeWidth={2} />
              <span>领取指南与实操避坑</span>
            </div>
            <ol style={{ margin: '0 0 1.2rem 0', paddingLeft: '1.2rem', color: 'var(--ink-soft)', fontSize: '0.85rem', lineHeight: '1.6' }}>
              {perk.steps.map((s, idx) => (
                <li key={idx} style={{ marginBottom: '0.4rem' }}>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </>
        )}

        <div className="meta-footer">
          资源福利均来自官方免费计划 (Free Tier / Community Programs)，规则与名额随时可能更新，建议尽快领取并规范使用。
        </div>
      </div>
    </div>
  );
};
