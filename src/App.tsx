import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TabType } from './types/common';
import { UCardItem as UCardItemType } from './types/u-card';
import { SimCardItem as SimCardItemType } from './types/sim-card';
import { AiStationItem as AiStationItemType } from './types/ai-station';
import { CreditCardItem as CreditCardItemType } from './types/credit-card';
import { PerkItem as PerkItemType } from './types/perk';

import { U_CARDS } from './data/u-cards';
import { SIM_CARDS } from './data/sim-cards';
import { AI_STATIONS } from './data/ai-stations';
import { CREDIT_CARDS } from './data/credit-cards';
import { PERKS } from './data/perks';

import { UCardGrid } from './components/u-card/UCardGrid';
import { UCardModal } from './components/u-card/UCardModal';
import { SimCardGrid } from './components/sim-card/SimCardGrid';
import { SimCardModal } from './components/sim-card/SimCardModal';
import { AiStationGrid } from './components/ai-hub/AiStationGrid';
import { AiStationModal } from './components/ai-hub/AiStationModal';
import { AccountPanel } from './components/account/AccountPanel';
import { CreditCardGrid } from './components/credit-card/CreditCardGrid';
import { CreditCardModal } from './components/credit-card/CreditCardModal';
import { PerkGrid } from './components/perk/PerkGrid';
import { PerkModal } from './components/perk/PerkModal';
import { useAiHubData } from './hooks/useAiHubData';
import { UserAccountProvider, useUserAccount } from './hooks/useUserAccount';

import { FluidContourBackdrop } from './components/awesome-ui/FluidContourBackdrop';
import { AnimatedCounter } from './components/awesome-ui/AnimatedCounter';
import { UiIcon } from './components/awesome-ui/UiIcon';

const BACKDROP_INK: [number, number, number] = [0.16, 0.20, 0.18];
const BACKDROP_PAPER: [number, number, number] = [0.98, 0.98, 0.96];

function parseHashLocation() {
  if (typeof window === 'undefined') {
    return { tab: 'u-cards' as TabType, cardId: null as string | null };
  }
  const raw = window.location.hash.replace('#/', '').replace('#', '');
  const [tabPart, queryPart] = raw.split('?');
  const validTabs: TabType[] = ['u-cards', 'sim-cards', 'ai-hub', 'credit-cards', 'perks', 'account'];
  const tab: TabType = validTabs.includes(tabPart as TabType) ? (tabPart as TabType) : 'u-cards';
  let cardId: string | null = null;
  if (queryPart) {
    const params = new URLSearchParams(queryPart);
    cardId = params.get('card') || params.get('id') || params.get('station') || params.get('perk') || params.get('sim');
  }
  return { tab, cardId };
}

/**
 * 用户中心入口（页脚）。顶部 tab 只承载知识/资源栏目，登录、注册与
 * 站点管理的统一入口收敛在页面底部；已登录时直接展示用户名。
 */
const AccountFooterLink: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { user } = useUserAccount();
  return (
    <p className="account-foot-link">
      <button
        type="button"
        className="account-foot-entry"
        onClick={onOpen}
        title="登录 / 注册 / 我的服务"
      >
        <i className="fa-solid fa-user-shield opacity-75 mr-1 text-[11px]" />
        <span>{user ? `用户中心 · ${user.displayName || user.email}` : '登录 / 注册'}</span>
      </button>
    </p>
  );
};

export const App: React.FC = () => {
  // Tab state synced with URL hash (supporting query parameters)
  const [currentTab, setCurrentTab] = useState<TabType>(() => parseHashLocation().tab);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);

  // AI Hub data (endpoint sync, live topology merge, admin session) lives at
  // App level: the merged station count feeds the nav badge, hero banner and
  // stat button, and deep links must resolve against the merged list.
  const hub = useAiHubData(AI_STATIONS);
  const stationsRef = useRef(hub.stations);
  stationsRef.current = hub.stations;

  const findAiStation = useCallback(
    (cardId: string): AiStationItemType | null =>
      stationsRef.current.find(
        (s) => s.id === cardId || s.name.toLowerCase().includes(cardId.toLowerCase())
      ) || null,
    []
  );

  const [selectedUCard, setSelectedUCard] = useState<UCardItemType | null>(() => {
    const { tab, cardId } = parseHashLocation();
    if (tab === 'u-cards' && cardId) {
      return U_CARDS.find((c) => c.slug === cardId || c.brand.toLowerCase().includes(cardId.toLowerCase())) || null;
    }
    return null;
  });

  const [selectedSimCard, setSelectedSimCard] = useState<SimCardItemType | null>(() => {
    const { tab, cardId } = parseHashLocation();
    if (tab === 'sim-cards' && cardId) {
      return SIM_CARDS.find((c) => c.id === cardId || c.name.toLowerCase().includes(cardId.toLowerCase())) || null;
    }
    return null;
  });

  // Deep-link resolution includes live upstream stations so shared links to
  // dynamic nodes (id `upstream-...`) resolve once the topology fetch lands
  // (late-resolution effect below).
  const [selectedAiStation, setSelectedAiStation] = useState<AiStationItemType | null>(() => {
    const { tab, cardId } = parseHashLocation();
    if (tab === 'ai-hub' && cardId) {
      return stationsRef.current.find(
        (s) => s.id === cardId || s.name.toLowerCase().includes(cardId.toLowerCase())
      ) || null;
    }
    return null;
  });

  const [selectedCreditCard, setSelectedCreditCard] = useState<CreditCardItemType | null>(() => {
    const { tab, cardId } = parseHashLocation();
    if (tab === 'credit-cards' && cardId) {
      return CREDIT_CARDS.find((c) => c.id === cardId || c.name.toLowerCase().includes(cardId.toLowerCase())) || null;
    }
    return null;
  });

  const [selectedPerk, setSelectedPerk] = useState<PerkItemType | null>(() => {
    const { tab, cardId } = parseHashLocation();
    if (tab === 'perks' && cardId) {
      return PERKS.find((p) => p.id === cardId || p.name.toLowerCase().includes(cardId.toLowerCase())) || null;
    }
    return null;
  });

  const syncHash = (tab: TabType, cardId: string | null) => {
    if (typeof window !== 'undefined') {
      if (cardId) {
        window.history.replaceState(null, '', `#/${tab}?card=${encodeURIComponent(cardId)}`);
      } else {
        window.history.replaceState(null, '', `#/${tab}`);
      }
    }
  };

  const handleSelectUCard = (card: UCardItemType | null) => {
    setSelectedUCard(card);
    syncHash('u-cards', card ? card.slug : null);
  };

  const handleSelectSimCard = (card: SimCardItemType | null) => {
    setSelectedSimCard(card);
    syncHash('sim-cards', card ? card.id : null);
  };

  const handleSelectAiStation = (station: AiStationItemType | null) => {
    setSelectedAiStation(station);
    syncHash('ai-hub', station ? station.id : null);
  };

  const handleSelectCreditCard = (card: CreditCardItemType | null) => {
    setSelectedCreditCard(card);
    syncHash('credit-cards', card ? card.id : null);
  };

  const handleSelectPerk = (perk: PerkItemType | null) => {
    setSelectedPerk(perk);
    syncHash('perks', perk ? perk.id : null);
  };

  // Sync tab with URL hash
  const handleTabChange = (tab: TabType) => {
    setCurrentTab(tab);
    setSearchQuery('');
    setSelectedUCard(null);
    setSelectedSimCard(null);
    setSelectedAiStation(null);
    setSelectedCreditCard(null);
    setSelectedPerk(null);
    window.location.hash = `#/${tab}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handleHashChange = () => {
      const { tab, cardId } = parseHashLocation();
      setCurrentTab(tab);
      setSelectedUCard(tab === 'u-cards' && cardId ? (U_CARDS.find((c) => c.slug === cardId || c.brand.toLowerCase().includes(cardId.toLowerCase())) || null) : null);
      setSelectedSimCard(tab === 'sim-cards' && cardId ? (SIM_CARDS.find((c) => c.id === cardId || c.name.toLowerCase().includes(cardId.toLowerCase())) || null) : null);
      setSelectedAiStation(tab === 'ai-hub' && cardId ? findAiStation(cardId) : null);
      setSelectedCreditCard(tab === 'credit-cards' && cardId ? (CREDIT_CARDS.find((c) => c.id === cardId || c.name.toLowerCase().includes(cardId.toLowerCase())) || null) : null);
      setSelectedPerk(tab === 'perks' && cardId ? (PERKS.find((p) => p.id === cardId || p.name.toLowerCase().includes(cardId.toLowerCase())) || null) : null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        const searchInput = document.querySelector<HTMLInputElement>('.controls input[type="search"]');
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
      }
    };

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [findAiStation]);

  // A deep link to a dynamic upstream station arrives before the topology
  // fetch resolves; re-resolve once the merged list appears.
  useEffect(() => {
    if (currentTab !== 'ai-hub' || selectedAiStation) return;
    const { tab, cardId } = parseHashLocation();
    if (tab !== 'ai-hub' || !cardId) return;
    const match = findAiStation(cardId);
    if (match) setSelectedAiStation(match);
  }, [hub.stations, currentTab, selectedAiStation, findAiStation]);

  const aiStationCount = hub.stations.length;

  const trustPillText = (() => {
    switch (currentTab) {
      case 'sim-cards':
        return `收录 ${SIM_CARDS.length} 款海外电话卡 / eSIM`;
      case 'ai-hub':
        return `收录 ${aiStationCount} 个活跃 AI 公益站节点`;
      case 'credit-cards':
        return `收录 ${CREDIT_CARDS.length} 张全球主流信用卡 / 账户`;
      case 'perks':
        return `精选 ${PERKS.length} 项出海与开发者高价值福利`;
      case 'account':
        return `管理员登录与站点管理控制台`;
      default:
        return `收录 ${U_CARDS.length} 张加密货币卡`;
    }
  })();

  // Tab-specific monochrome trust avatar icons matching the Swiss aesthetic
  const TAB_TRUST_ICONS: Record<TabType, { icon: string; title: string }[]> = {
    'u-cards': [
      { icon: 'fa-brands fa-cc-visa', title: 'Visa 国际清算网络' },
      { icon: 'fa-brands fa-cc-mastercard', title: 'Mastercard 国际清算网络' },
      { icon: 'fa-brands fa-bitcoin', title: 'Bitcoin 原生加密网络' },
      { icon: 'fa-brands fa-ethereum', title: 'Ethereum 智能合约生态' },
    ],
    'sim-cards': [
      { icon: 'fa-solid fa-sim-card', title: '实体 SIM / 电子 eSIM' },
      { icon: 'fa-solid fa-tower-broadcast', title: '全球蜂窝基站覆盖' },
      { icon: 'fa-solid fa-globe', title: '跨国无缝漫游' },
      { icon: 'fa-solid fa-comment-sms', title: '国内免费接收短信' },
    ],
    'ai-hub': [
      { icon: 'fa-solid fa-brain', title: '大语言模型认知中枢' },
      { icon: 'fa-solid fa-wand-magic-sparkles', title: '生成式 AI 智能体' },
      { icon: 'fa-solid fa-robot', title: '多模型 API 聚合调度' },
      { icon: 'fa-solid fa-bolt', title: '低延迟公网高速节点' },
    ],
    'credit-cards': [
      { icon: 'fa-brands fa-cc-amex', title: 'American Express 顶级运通' },
      { icon: 'fa-brands fa-cc-visa', title: 'Visa 经典卡组织' },
      { icon: 'fa-brands fa-cc-mastercard', title: 'Mastercard 极速清算' },
      { icon: 'fa-brands fa-apple-pay', title: 'Apple Pay 便捷绑卡支付' },
    ],
    'perks': [
      { icon: 'fa-solid fa-gift', title: '高价值精选羊毛福利' },
      { icon: 'fa-solid fa-cloud', title: '全球云基础设施' },
      { icon: 'fa-brands fa-github', title: 'GitHub 开发者开源生态' },
      { icon: 'fa-solid fa-server', title: '永久免费算力与 VPS' },
    ],
    'account': [
      { icon: 'fa-solid fa-user-shield', title: '管理员身份认证' },
      { icon: 'fa-solid fa-key', title: 'API 站点登录令牌' },
      { icon: 'fa-solid fa-server', title: 'API 站点管理后台' },
      { icon: 'fa-solid fa-sliders', title: '公益站拓扑配置' },
    ],
  };

  return (
    <UserAccountProvider>
      {/* Dynamic WebGL Simplex Noise Contour Backdrop */}
      <FluidContourBackdrop
        inkColor={BACKDROP_INK}
        paperColor={BACKDROP_PAPER}
        speed={0.032}
        interactive={true}
      />

      <div className="page">
        {/* Masthead matching card.mangoqwq.com */}
        <header className="masthead">
          {/* Trust Avatars & Pill - Dynamic per Tab */}
          <div className="trust anim" style={{ '--d': '0.05s' } as React.CSSProperties}>
            {TAB_TRUST_ICONS[currentTab].map((item, idx) => (
              <span key={`${currentTab}-${idx}`} className="trust-avatar" title={item.title}>
                <span>
                  <i className={item.icon} />
                </span>
              </span>
            ))}
            <span className="trust-pill">{trustPillText}</span>
          </div>

          {/* Bubbledot Headline with Brand Logo */}
          <h1 className="headline">
            <span className="headline-inner">
              <img
                src="/logo.png"
                alt="MangoShare Logo"
                className="headline-logo"
              />
              <span>mangoshare</span>
            </span>
          </h1>

          {/* Subhead */}
          <p className="subhead anim" style={{ '--d': '0.24s' } as React.CSSProperties}>
            发现、比较和选择最适合你的出海资产与数字资源
          </p>

          {/* Minimalist Tab Navigation Bar with Themed Icons */}
          <nav
            className="tab-nav anim"
            style={{ '--d': '0.32s' } as React.CSSProperties}
            aria-label="资源分类"
          >
            <button
              type="button"
              className={`pill ${currentTab === 'u-cards' ? 'active' : ''}`}
              onClick={() => handleTabChange('u-cards')}
            >
              <i className="fa-brands fa-bitcoin opacity-75 mr-1 text-[11px]" />
              <span>加密货币卡</span>
              <span className="pill-badge">{U_CARDS.length}</span>
            </button>

            <button
              type="button"
              className={`pill ${currentTab === 'sim-cards' ? 'active' : ''}`}
              onClick={() => handleTabChange('sim-cards')}
            >
              <i className="fa-solid fa-sim-card opacity-75 mr-1 text-[11px]" />
              <span>电话卡 / eSIM</span>
              <span className="pill-badge">{SIM_CARDS.length}</span>
            </button>

            <button
              type="button"
              className={`pill ${currentTab === 'ai-hub' ? 'active' : ''}`}
              onClick={() => handleTabChange('ai-hub')}
            >
              <i className="fa-solid fa-wand-magic-sparkles opacity-75 mr-1 text-[11px]" />
              <span>AI 公益站</span>
              <span className="pill-badge">{aiStationCount}</span>
            </button>

            <button
              type="button"
              className={`pill ${currentTab === 'credit-cards' ? 'active' : ''}`}
              onClick={() => handleTabChange('credit-cards')}
            >
              <i className="fa-regular fa-credit-card opacity-75 mr-1 text-[11px]" />
              <span>全球信用卡</span>
              <span className="pill-badge">{CREDIT_CARDS.length}</span>
            </button>

            <button
              type="button"
              className={`pill ${currentTab === 'perks' ? 'active' : ''}`}
              onClick={() => handleTabChange('perks')}
            >
              <i className="fa-solid fa-gift opacity-75 mr-1 text-[11px]" />
              <span>羊毛福利</span>
              <span className="pill-badge">{PERKS.length}</span>
            </button>

            {/* 用户中心入口已移至页脚：顶部 tab 只保留知识/资源栏目 */}
          </nav>

          {/* 4-Column Stats Bar - Interactive Tab Switchers */}
          <div className="stats">
            <div
              className={`stat anim clickable ${currentTab === 'u-cards' ? 'active' : ''}`}
              style={{ '--d': '0.4s' } as React.CSSProperties}
              onClick={() => handleTabChange('u-cards')}
              role="button"
              tabIndex={0}
              title="点击查看加密货币 U 卡"
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleTabChange('u-cards')}
            >
              <div className="stat-icon">*</div>
              <div className="stat-value">
                <AnimatedCounter target={U_CARDS.length} suffix="+" duration={1000} />
              </div>
              <div className="stat-label">收录 U 卡</div>
            </div>

            <div
              className={`stat anim clickable ${currentTab === 'sim-cards' ? 'active' : ''}`}
              style={{ '--d': '0.48s' } as React.CSSProperties}
              onClick={() => handleTabChange('sim-cards')}
              role="button"
              tabIndex={0}
              title="点击查看全球电话卡与 eSIM"
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleTabChange('sim-cards')}
            >
              <div className="stat-icon">#</div>
              <div className="stat-value">
                <AnimatedCounter target={SIM_CARDS.length} suffix="款" duration={1000} />
              </div>
              <div className="stat-label">电话卡 / eSIM</div>
            </div>

            <div
              className={`stat anim clickable ${currentTab === 'ai-hub' ? 'active' : ''}`}
              style={{ '--d': '0.56s' } as React.CSSProperties}
              onClick={() => handleTabChange('ai-hub')}
              role="button"
              tabIndex={0}
              title="点击查看活跃 AI 公益站节点"
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleTabChange('ai-hub')}
            >
              <div className="stat-icon">%</div>
              <div className="stat-value">
                <AnimatedCounter target={aiStationCount} suffix="个" duration={1000} />
              </div>
              <div className="stat-label">AI 公益站节点</div>
            </div>

            <div
              className={`stat anim clickable ${['credit-cards', 'perks'].includes(currentTab) ? 'active' : ''}`}
              style={{ '--d': '0.64s' } as React.CSSProperties}
              onClick={() => handleTabChange(currentTab === 'perks' ? 'perks' : 'credit-cards')}
              role="button"
              tabIndex={0}
              title="点击查看全球信用卡与羊毛福利"
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleTabChange(currentTab === 'perks' ? 'perks' : 'credit-cards')}
            >
              <div className="stat-icon">◇</div>
              <div className="stat-value">
                <AnimatedCounter target={CREDIT_CARDS.length + PERKS.length} suffix="项" duration={1000} />
              </div>
              <div className="stat-label">信用卡 & 羊毛</div>
            </div>
          </div>
        </header>

        {/* Tab Content Display */}
        <main>
          {currentTab === 'u-cards' && (
            <UCardGrid
              cards={U_CARDS}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectCard={handleSelectUCard}
            />
          )}

          {currentTab === 'sim-cards' && (
            <SimCardGrid
              cards={SIM_CARDS}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectCard={handleSelectSimCard}
            />
          )}

          {currentTab === 'ai-hub' && (
            <AiStationGrid
              stations={hub.stations}
              channelCount={hub.mergedMeta.channelCount}
              upstreamCount={hub.mergedMeta.upstreamCount}
              apiEndpoint={hub.endpoint}
              apiModelCount={hub.models.length}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectStation={handleSelectAiStation}
            />
          )}

          {currentTab === 'credit-cards' && (
            <CreditCardGrid
              cards={CREDIT_CARDS}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectCard={handleSelectCreditCard}
            />
          )}

          {currentTab === 'perks' && (
            <PerkGrid
              perks={PERKS}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectPerk={handleSelectPerk}
            />
          )}

          {currentTab === 'account' && (
            <AccountPanel
              endpoint={hub.endpoint}
              onEndpointChange={hub.handleEndpointChange}
              isLoading={hub.isLoading}
              error={hub.error}
              statusData={hub.statusData}
              models={hub.models}
              stations={hub.stations}
              onRefresh={hub.refresh}
              onPersistStations={hub.persistStations}
              onResetStations={hub.resetStations}
              isAdmin={hub.isAdmin}
              adminSession={hub.adminSession}
              onLogin={hub.handleAdminLogin}
              onLogout={hub.handleAdminLogout}
            />
          )}
        </main>

        {/* Footnote */}
        <footer className="foot-note anim" style={{ '--d': '0.7s' } as React.CSSProperties}>
          <AccountFooterLink onOpen={() => handleTabChange('account')} />
          <p>
            资料来自各卡官网与公开信息整理，可能随政策调整而变化，开卡前请以官方页面为准。<br />
            如有错漏或想了解的卡/资源不在列表内，欢迎
            <a href="mailto:dengyietech@gmail.com">联系我</a>反馈。
          </p>
        </footer>

        {/* Detail Modals for all tabs */}
        <UCardModal
          card={selectedUCard}
          onClose={() => handleSelectUCard(null)}
          allCards={U_CARDS}
          onSelectVariant={(slug) => {
            const match = U_CARDS.find((c) => c.slug === slug);
            if (match) handleSelectUCard(match);
          }}
        />

        <SimCardModal
          card={selectedSimCard}
          onClose={() => handleSelectSimCard(null)}
        />

        <AiStationModal
          station={selectedAiStation}
          onClose={() => handleSelectAiStation(null)}
        />

        <CreditCardModal
          card={selectedCreditCard}
          onClose={() => handleSelectCreditCard(null)}
        />

        <PerkModal
          perk={selectedPerk}
          onClose={() => handleSelectPerk(null)}
        />

        {/* Floating Back to Top Button */}
        <button
          type="button"
          className={`scroll-top-btn ${showScrollTop ? 'visible' : ''}`}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title="返回顶部"
          aria-label="返回顶部"
        >
          <UiIcon name="chevron-up" size={16} strokeWidth={2.5} />
        </button>
      </div>
    </UserAccountProvider>
  );
};
