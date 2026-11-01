import React, { useEffect, useRef, useState } from 'react';
import { AiStationItem } from '../../types/ai-station';
import { getAiStationArt } from '../../utils/card-art';
import { copyToClipboard } from '../../utils/clipboard';
import { useModalLock } from '../../utils/use-modal-lock';
import { generateNewApiChannelJson } from '../../utils/api-station-sync';
import { ItemMarkControl } from '../account/ItemMarkControl';
import { UiIcon } from '../awesome-ui/UiIcon';

interface AiStationModalProps {
  station: AiStationItem | null;
  onClose: () => void;
  apiEndpoint?: string;
}

export const AiStationModal: React.FC<AiStationModalProps> = ({ station, onClose, apiEndpoint }) => {
  const [copied, setCopied] = useState(false);
  const [channelCopied, setChannelCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  useModalLock(Boolean(station), onClose);

  // Timers for transient "copied" flags: cleared on reset to avoid erasing a
  // newer flag, and flushed on unmount to avoid setState after unmount.
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const pending = timersRef.current;
    return () => {
      pending.forEach(clearTimeout);
    };
  }, []);
  useEffect(() => {
    if (!station) {
      setCopied(false);
      setChannelCopied(false);
      setShareCopied(false);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    }
  }, [station]);
  const flash = (setter: (v: boolean) => void) => {
    setter(true);
    const t = setTimeout(() => setter(false), 2000);
    timersRef.current.push(t);
  };

  if (!station) return null;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  const handleCopyBaseUrl = async () => {
    const success = await copyToClipboard(station.apiBaseUrl);
    if (success) flash(setCopied);
  };

  const handleCopyNewApiChannel = async () => {
    const payload = generateNewApiChannelJson(station);
    const jsonStr = JSON.stringify(payload, null, 2);
    const success = await copyToClipboard(jsonStr);
    if (success) flash(setChannelCopied);
  };

  const handleCopyShareLink = async () => {
    const origin = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://share.mangoqwq.com/';
    const shareUrl = `${origin}#/ai-hub?card=${encodeURIComponent(station.id)}`;
    const success = await copyToClipboard(shareUrl);
    if (success) flash(setShareCopied);
  };

  const cardArt = getAiStationArt(station.id, station.name, station.category, station.models, station.portalUrl);

  const cleanBaseUrl = station.apiBaseUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/v1$/, '')
    .replace(/\/api\/v1$/, '');

  const channelTypeDesc = (() => {
    if (station.id === 'openrouter-free') return 'Type 20 (OpenRouter)';
    if (station.category === 'NewAPI') return 'Type 60 (New API 核心协议)';
    // Keep in sync with generateNewApiChannelJson: generic gateways default to
    // type 1 ([OI] protocol) because backend path-concats /v1/chat/completions.
    return 'Type 1 ([OI] 协议兼容网关)';
  })();

  const channelTypeLabel = channelTypeDesc.match(/^Type (\d+)/)?.[1] ?? '?';

  // upstream-* 动态卡的 id 由后端探测结果生成，刷新后可能变化，不参与勾选。
  const markable = !station.id.startsWith('upstream-');

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
            <span>返回 AI 节点列表</span>
          </button>
        </div>

        {/* Hero Card Image with Glare */}
        <div className="hero-card" onPointerMove={handlePointerMove}>
          <img src={cardArt} alt={`${station.name} 卡面`} />
        </div>

        <div className="card-title">{station.name}</div>
        <div className="card-brand">{station.category} 架构 · {station.authType} 认证</div>

        {/* 3-Column Key Stats */}
        <div className="stats-detail">
          <div className="stat-detail-item">
            <span className="stat-detail-value">{station.quotaDesc.split('(')[0].trim()}</span>
            <span className="stat-detail-label">免费额度机制</span>
          </div>
          <div className="stat-detail-item">
            <span className="stat-detail-value">OpenAI/Claude</span>
            <span className="stat-detail-label">标准协议</span>
          </div>
          <div className="stat-detail-item">
            <span className="stat-detail-value" style={{ color: 'oklch(0.55 0.12 155)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
              探活正常
            </span>
            <span className="stat-detail-label">节点状态</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="cta-row">
          <a
            href={station.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="apply-btn"
          >
            <span>前往控制台/签到</span>
            <UiIcon name="external-link" size={13} strokeWidth={2.2} />
          </a>

          <button
            type="button"
            className={`invite-pill ${copied ? 'copied' : ''}`}
            onClick={handleCopyBaseUrl}
          >
            <span>API Base: <strong>{station.apiBaseUrl}</strong></span>
            <UiIcon name={copied ? "check" : "copy"} size={14} strokeWidth={2} style={{ color: copied ? '#10b981' : 'inherit' }} />
            <span style={{ fontSize: '0.74rem', color: copied ? '#10b981' : 'inherit' }}>
              {copied ? '已复制' : '复制'}
            </span>
          </button>

          <button
            type="button"
            className={`invite-pill ${channelCopied ? 'copied' : ''}`}
            onClick={handleCopyNewApiChannel}
            title="一键复制适配 New API / One API 的渠道配置 JSON"
          >
            <span>New API 渠道: <strong>Type {channelTypeLabel}</strong></span>
            <UiIcon name={channelCopied ? "check" : "code"} size={14} strokeWidth={2} style={{ color: channelCopied ? '#10b981' : 'inherit' }} />
            <span style={{ fontSize: '0.74rem', color: channelCopied ? '#10b981' : 'inherit' }}>
              {channelCopied ? '已复制JSON' : '复制渠道JSON'}
            </span>
          </button>

          <button
            type="button"
            className={`share-pill ${shareCopied ? 'copied' : ''}`}
            onClick={handleCopyShareLink}
            title="复制此公益站直达分享链接"
          >
            <UiIcon name={shareCopied ? "check" : "link"} size={13} strokeWidth={2.2} />
            <span>{shareCopied ? '已复制直达链接' : '分享此站'}</span>
          </button>
        </div>

        {/* 我的标记（已开通 / 待开通） */}
        {markable && <ItemMarkControl itemType="ai-station" itemId={station.id} />}

        {/* Supported Models */}
        {station.models && station.models.length > 0 && (
          <div>
            <div className="section-label">支持的主要模型</div>
            <div className="plats">
              {station.models.map((m) => (
                <span key={m} className="plat supported" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <UiIcon name="check" size={12} className="mark" />
                  <span>{m}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Basic Specs */}
        <div>
          <div className="section-label">端点与接入配置</div>
          <div className="specs-list">
            <div className="spec-row">
              <span className="spec-label">客户端 Base URL</span>
              <span className="spec-val font-mono">{station.apiBaseUrl}</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">New API 代理地址</span>
              <span className="spec-val font-mono">{cleanBaseUrl}</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">New API 推荐类型</span>
              <span className="spec-val">{channelTypeDesc}</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">鉴权登录模式</span>
              <span className="spec-val">{station.authType}</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Cloudflare Turnstile 验证</span>
              <span className="spec-val">{station.turnstile ? '开启' : '无'}</span>
            </div>
          </div>
        </div>

        {/* Usage Instructions */}
        <div>
          <div className="section-label">客户端与网关使用指引</div>
          <ul className="bullets">
            <li>
              <strong>终端客户端（NextChat / Cherry Studio / Cursor）</strong>：将上方客户端 <code>Base URL</code> 填入客户端，粘贴控制台生成的 <code>sk-</code> 令牌即可使用。
            </li>
            <li>
              <strong>API 站点中转（New API / One API / MangoApi）</strong>：点击上方「复制渠道JSON」按钮，在管理后台渠道页面直接黏贴或通过 API 批量导入，系统已自动剔除 <code>/v1</code> 避免重复拼接。
            </li>
            <li>
              <strong>额度保持与保活</strong>：多数公益站点支持每日一键打卡或 Linux.do 快速授权获取可用额度。
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
