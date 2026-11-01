import React, { useMemo, useState } from 'react';
import { AiStationItem as AiStationItemType } from '../../types/ai-station';
import { ApiStationStatus } from '../../types/api-sync';
import type { AccountUser, MyItemEntry, MyItemStatus, MyItemType } from '../../types/account';
import { analyzeTopology } from '../../utils/api-station-sync';
import {
  AdminSession,
  completeAdminLogin,
  startAdminLogin,
} from '../../utils/admin-auth';
import { CATEGORY_ORDER, categoryLabelOf, deepLinkFor, findCatalogEntry } from '../../utils/catalog-index';
import { accountApiErrorMessage, useUserAccount } from '../../hooks/useUserAccount';
import { ApiSyncPanel } from '../ai-hub/ApiSyncPanel';
import { BestConfigModal } from '../ai-hub/BestConfigModal';
import { StationImportModal } from '../ai-hub/StationImportModal';
import { UiIcon } from '../awesome-ui/UiIcon';

interface AccountPanelProps {
  endpoint: string;
  onEndpointChange: (url: string) => void;
  isLoading: boolean;
  error: string | null;
  statusData: ApiStationStatus | null;
  models: string[];
  stations: AiStationItemType[];
  onRefresh: () => void;
  onPersistStations: (newStations: AiStationItemType[]) => void;
  onResetStations: () => void;
  isAdmin: boolean;
  adminSession: AdminSession | null;
  onLogin: (session: AdminSession) => void;
  onLogout: () => void;
}

type GuestMode = 'login' | 'register' | 'forgot';

/**
 * 用户中心。一个登录入口，按账号区分界面：
 * - 访客：登录 / 注册（邮箱验证码）/ 忘记密码，本地勾选会在登录后自动合并；
 * - 登录用户：账号信息 + 「我的服务」清单 + 退出；
 * - 站长：本地账号邮箱匹配后端 ADMIN_EMAIL（role=admin）时，登录后额外
 *   解锁「API 站管理控制台」。控制台仍需 API 站自身凭据 + 2FA —— 那是
 *   独立系统的授权，站内账号只负责开门。
 */
export const AccountPanel: React.FC<AccountPanelProps> = ({
  endpoint,
  onEndpointChange,
  isLoading,
  error,
  statusData,
  models,
  stations,
  onRefresh,
  onPersistStations,
  onResetStations,
  isAdmin,
  adminSession,
  onLogin,
  onLogout,
}) => {
  const account = useUserAccount();
  const [adminAreaOpen, setAdminAreaOpen] = useState(false);

  // ---- 已登录视图 --------------------------------------------------------
  if (account.user) {
    return (
      <div className="flex flex-col gap-6">
        <UserDashboard
          user={account.user}
          items={Array.from(account.items.values())}
          counts={account.counts}
          onUnmark={account.setItemStatus}
          onLogout={() => void account.logout()}
        />
        {account.user.role === 'admin' ? (
          <AdminArea
            open={adminAreaOpen}
            onToggle={() => setAdminAreaOpen((v) => !v)}
            endpoint={endpoint}
            onEndpointChange={onEndpointChange}
            isLoading={isLoading}
            error={error}
            statusData={statusData}
            models={models}
            stations={stations}
            onRefresh={onRefresh}
            onPersistStations={onPersistStations}
            onResetStations={onResetStations}
            isAdmin={isAdmin}
            adminSession={adminSession}
            onAdminLogin={onLogin}
            onAdminLogout={onLogout}
          />
        ) : null}
      </div>
    );
  }

  // ---- 访客视图：只保留唯一的登录 / 注册入口 -------------------------------
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <GuestAuthPanel />
    </div>
  );
};

// ---- 访客：登录 / 注册 / 忘记密码 ----------------------------------------

const inputClass =
  'rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--ink)]';

const GuestAuthPanel: React.FC = () => {
  const account = useUserAccount();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // 验证码发送冷却倒计时
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleSendCode = async () => {
    if (cooldown > 0 || submitting) return;
    if (!email.trim()) {
      setErrorMessage('请先输入邮箱');
      return;
    }
    setErrorMessage(null);
    try {
      await account.sendCode(email.trim(), mode === 'forgot' ? 'reset' : 'register');
      setCooldown(60);
      setNotice('请求已受理。如邮箱符合条件且邮件投递成功，请查收验证码（10 分钟内有效）；未收到请稍后重试。');
    } catch (err) {
      setNotice(null);
      setErrorMessage(accountApiErrorMessage(err, '验证码发送失败，请稍后重试'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMessage(null);
    setNotice(null);
    try {
      if (mode === 'login') {
        if (!email.trim() || !password) {
          setErrorMessage('请输入邮箱与密码');
          return;
        }
        setSubmitting(true);
        await account.login(email.trim(), password);
      } else if (mode === 'register') {
        if (!email.trim() || !code.trim() || !password) {
          setErrorMessage('请填写邮箱、验证码与密码');
          return;
        }
        if (password.length < 8) {
          setErrorMessage('密码至少 8 位');
          return;
        }
        if (password !== confirmPassword) {
          setErrorMessage('两次输入的密码不一致');
          return;
        }
        setSubmitting(true);
        await account.register(email.trim(), code.trim(), password, displayName.trim());
      } else {
        if (!email.trim() || !code.trim() || !password) {
          setErrorMessage('请填写邮箱、验证码与新密码');
          return;
        }
        if (password.length < 8) {
          setErrorMessage('密码至少 8 位');
          return;
        }
        setSubmitting(true);
        await account.resetPassword(email.trim(), code.trim(), password);
      }
      // 成功后 useUserAccount 已切到登录态，本组件随之卸载
    } catch (err) {
      setErrorMessage(accountApiErrorMessage(err, '操作失败，请稍后重试'));
    } finally {
      setSubmitting(false);
    }
  };

  const modeTabs: { id: typeof mode; label: string }[] = [
    { id: 'login', label: '登录' },
    { id: 'register', label: '注册' },
  ];

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <UiIcon name="shield" size={15} className="text-[var(--ink)]" />
        <h2 className="text-sm font-semibold tracking-wide text-[var(--ink)]">
          {mode === 'forgot' ? '找回密码' : '用户中心'}
        </h2>
      </div>

      {mode !== 'forgot' ? (
        <div className="mb-3 flex gap-1 rounded-lg border border-[var(--line)] p-1">
          {modeTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setMode(tab.id);
                setErrorMessage(null);
                setNotice(null);
              }}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === tab.id
                  ? 'bg-[var(--ink)] text-[var(--paper)]'
                  : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      {mode === 'login' ? (
        <p className="mb-3 text-xs leading-relaxed text-[var(--ink-soft)]">
          登录后可保存你的「已开通 / 待开通」清单，跨设备同步。未登录时的勾选会保留在本机，登录后自动合并。
        </p>
      ) : mode === 'register' ? (
        <p className="mb-3 text-xs leading-relaxed text-[var(--ink-soft)]">
          注册即表示同意仅将勾选清单与账号邮箱用于本站功能。邮箱验证码 10 分钟内有效。
        </p>
      ) : (
        <p className="mb-3 text-xs leading-relaxed text-[var(--ink-soft)]">
          输入注册邮箱与邮件验证码设置新密码；重置后所有登录态将失效，需重新登录。
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--ink-soft)]">
          邮箱
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={inputClass}
            placeholder="you@example.com"
          />
        </label>

        {mode !== 'login' ? (
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--ink-soft)]">
            验证码
            <span className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                className={`${inputClass} flex-1 font-mono tracking-widest`}
                placeholder="6 位数字"
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={cooldown > 0 || submitting}
                className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-medium text-[var(--ink)] transition-colors hover:bg-[var(--paper-muted)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cooldown > 0 ? `${cooldown}s 后重发` : '发送验证码'}
              </button>
            </span>
          </label>
        ) : null}

        {mode === 'register' ? (
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--ink-soft)]">
            昵称（选填）
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={32}
              className={inputClass}
              placeholder="将展示在用户中心"
            />
          </label>
        ) : null}

        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--ink-soft)]">
          {mode === 'forgot' ? '新密码' : '密码'}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className={inputClass}
            placeholder={mode === 'login' ? '密码' : '至少 8 位'}
          />
        </label>

        {mode === 'register' ? (
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--ink-soft)]">
            确认密码
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
              placeholder="再输入一次密码"
            />
          </label>
        ) : null}

        {errorMessage && (
          <div className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            <UiIcon name="alert-triangle" size={13} />
            <span>{errorMessage}</span>
          </div>
        )}
        {notice && !errorMessage && (
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
            <UiIcon name="check" size={13} />
            <span>{notice}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || (mode === 'login' && account.sessionReady === false)}
          className={`mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--paper)] transition-all hover:opacity-90 active:scale-[0.98] ${
            submitting ? 'cursor-not-allowed opacity-60' : ''
          }`}
        >
          <UiIcon name="lock" size={14} className={submitting ? 'animate-pulse' : ''} />
          <span>
            {submitting
              ? '处理中…'
              : mode === 'login'
                ? '登录'
                : mode === 'register'
                  ? '注册并登录'
                  : '重置密码并登录'}
          </span>
        </button>
      </form>

      <div className="mt-3 text-center text-xs text-[var(--ink-soft)]">
        {mode === 'login' ? (
          <>
            <button type="button" className="underline underline-offset-2 hover:text-[var(--ink)]" onClick={() => { setMode('register'); setErrorMessage(null); }}>
              没有账号？注册
            </button>
            <span className="mx-2 opacity-40">·</span>
            <button type="button" className="underline underline-offset-2 hover:text-[var(--ink)]" onClick={() => { setMode('forgot'); setErrorMessage(null); setNotice(null); }}>
              忘记密码
            </button>
          </>
        ) : (
          <button type="button" className="underline underline-offset-2 hover:text-[var(--ink)]" onClick={() => { setMode('login'); setErrorMessage(null); setNotice(null); }}>
            返回登录
          </button>
        )}
      </div>
    </div>
  );
};

// ---- 已登录：我的服务 ----------------------------------------------------

const UserDashboard: React.FC<{
  user: AccountUser;
  items: MyItemEntry[];
  counts: { opened: number; wanted: number };
  onUnmark: (itemType: MyItemType, itemId: string, status: null) => void;
  onLogout: () => void;
}> = ({ user, items, counts, onUnmark, onLogout }) => {
  const [statusFilter, setStatusFilter] = useState<'opened' | 'wanted'>('opened');
  const [typeFilter, setTypeFilter] = useState<'all' | 'u-card' | 'sim-card' | 'credit-card' | 'perk' | 'ai-station'>('all');

  const filtered = useMemo(
    () =>
      items
        .filter((it) => it.status === statusFilter)
        .filter((it) => typeFilter === 'all' || it.itemType === typeFilter)
        .map((it) => ({ entry: it, catalog: findCatalogEntry(it.itemType, it.itemId) })),
    [items, statusFilter, typeFilter]
  );

  const typeCounts = useMemo(() => {
    const map = new Map<string, { opened: number; wanted: number }>();
    for (const it of items) {
      const bucket = map.get(it.itemType) ?? { opened: 0, wanted: 0 };
      bucket[it.status] += 1;
      map.set(it.itemType, bucket);
    }
    return map;
  }, [items]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <UiIcon name="shield" size={15} className="text-emerald-600" />
            <h2 className="text-sm font-semibold tracking-wide text-[var(--ink)]">
              {user.displayName || user.email}
            </h2>
            {user.role === 'admin' ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50/70 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                站长
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            已开通 {counts.opened} 项 · 待开通 {counts.wanted} 项。点击列表条目可查看详情弹窗。
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper-muted)] hover:text-[var(--ink)]"
        >
          退出登录
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] p-5 shadow-sm">
        {/* 状态切换：已开通 / 待开通 分开看 */}
        <div className="mb-3 flex gap-1 rounded-lg border border-[var(--line)] p-1">
          {(['opened', 'wanted'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-[var(--ink)] text-[var(--paper)]'
                  : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
              }`}
            >
              {s === 'opened' ? `已开通 (${counts.opened})` : `待开通 (${counts.wanted})`}
            </button>
          ))}
        </div>

        {/* 栏目筛选 */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(['all', ...CATEGORY_ORDER] as const).map((t) => {
            const active = typeFilter === t;
            const bucket =
              t === 'all'
                ? counts
                : typeCounts.get(t) ?? { opened: 0, wanted: 0 };
            const label = t === 'all' ? '全部' : categoryLabelOf(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]'
                    : 'border-[var(--line)] text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`}
              >
                {label} {bucket[statusFilter]}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-xs leading-relaxed text-[var(--ink-soft)]">
            这里还是空的。去各栏目把卡片标记为「已开通」或「待开通」吧 ——
            详情弹窗内即可标记。
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--line)]">
            {filtered.map(({ entry, catalog }) => (
              <li key={`${entry.itemType}:${entry.itemId}`} className="flex items-center justify-between gap-3 py-2">
                {catalog ? (
                  <a
                    href={deepLinkFor(catalog)}
                    className="min-w-0 flex-1 truncate text-sm text-[var(--ink)] underline-offset-2 hover:underline"
                    title={catalog.name}
                  >
                    {catalog.name}
                  </a>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink-soft)]" title={entry.itemId}>
                    {entry.itemId}
                  </span>
                )}
                <span className="shrink-0 text-[11px] text-[var(--ink-soft)]">
                  {catalog?.categoryLabel ?? categoryLabelOf(entry.itemType)}
                </span>
                <button
                  type="button"
                  onClick={() => onUnmark(entry.itemType, entry.itemId, null)}
                  className="shrink-0 rounded-md border border-[var(--line)] px-2 py-1 text-[11px] text-[var(--ink-soft)] transition-colors hover:border-rose-300 hover:text-rose-600"
                  title="移除标记"
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// ---- 管理员区块（原控制台，折叠保留）-------------------------------------

const inputClassAdmin =
  'rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 font-mono text-sm tracking-widest text-[var(--ink)] outline-none focus:border-[var(--ink)]';

interface AdminAreaProps {
  open: boolean;
  onToggle: () => void;
  endpoint: string;
  onEndpointChange: (url: string) => void;
  isLoading: boolean;
  error: string | null;
  statusData: ApiStationStatus | null;
  models: string[];
  stations: AiStationItemType[];
  onRefresh: () => void;
  onPersistStations: (newStations: AiStationItemType[]) => void;
  onResetStations: () => void;
  isAdmin: boolean;
  adminSession: AdminSession | null;
  onAdminLogin: (session: AdminSession) => void;
  onAdminLogout: () => void;
}

const AdminArea: React.FC<AdminAreaProps> = ({
  open,
  onToggle,
  endpoint,
  onEndpointChange,
  isLoading,
  error,
  statusData,
  models,
  stations,
  onRefresh,
  onPersistStations,
  onResetStations,
  isAdmin,
  adminSession,
  onAdminLogin,
  onAdminLogout,
}) => {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] p-5 shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-xs font-medium text-[var(--ink-soft)]">
          <UiIcon name="shield" size={13} />
          API 站管理入口（站长）
        </span>
        <UiIcon name={open ? 'chevron-up' : 'chevron-down'} size={13} className="text-[var(--ink-soft)]" />
      </button>

      {open ? (
        <div className="mt-4">
          <AdminLoginSection
            endpoint={endpoint}
            isLoading={isLoading}
            error={error}
            models={models}
            stations={stations}
            statusData={statusData}
            onEndpointChange={onEndpointChange}
            onRefresh={onRefresh}
            onPersistStations={onPersistStations}
            onResetStations={onResetStations}
            isAdmin={isAdmin}
            adminSession={adminSession}
            onAdminLogin={onAdminLogin}
            onAdminLogout={onAdminLogout}
          />
        </div>
      ) : null}
    </div>
  );
};

/**
 * Legacy admin login + console, extracted verbatim in behavior: visitors see
 * the login form (2FA two-step preserved); verified admin sessions render
 * the management console.
 */
const AdminLoginSection: React.FC<{
  endpoint: string;
  onEndpointChange: (url: string) => void;
  isLoading: boolean;
  error: string | null;
  statusData: ApiStationStatus | null;
  models: string[];
  stations: AiStationItemType[];
  onRefresh: () => void;
  onPersistStations: (newStations: AiStationItemType[]) => void;
  onResetStations: () => void;
  isAdmin: boolean;
  adminSession: AdminSession | null;
  onAdminLogin: (session: AdminSession) => void;
  onAdminLogout: () => void;
}> = ({
  endpoint,
  onEndpointChange,
  isLoading,
  error,
  statusData,
  models,
  stations,
  onRefresh,
  onPersistStations,
  onResetStations,
  isAdmin,
  adminSession,
  onAdminLogin,
  onAdminLogout,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingFlowToken, setPendingFlowToken] = useState<string | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBestConfigOpen, setIsBestConfigOpen] = useState(false);

  const topologyAnalysis = useMemo(
    () => analyzeTopology(models, stations),
    [models, stations]
  );

  const domainDisplay = (() => {
    try {
      const u = new URL(endpoint.startsWith('http') ? endpoint : `https://${endpoint}`);
      return u.hostname;
    } catch {
      return endpoint;
    }
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!username.trim() || !password) {
      setErrorMessage('请输入用户名与密码');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const attempt = await startAdminLogin(endpoint, username.trim(), password);
      if (attempt.kind === 'session') {
        setPassword('');
        setUsername('');
        onAdminLogin(attempt.session);
      } else {
        setPassword('');
        setPendingFlowToken(attempt.flowToken);
        setErrorMessage(null);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '登录失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTwoFaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !pendingFlowToken) return;
    if (!twoFaCode.trim()) {
      setErrorMessage('请输入两步验证码');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const session = await completeAdminLogin(
        endpoint,
        pendingFlowToken,
        twoFaCode,
        username.trim()
      );
      setTwoFaCode('');
      setPendingFlowToken(null);
      setUsername('');
      onAdminLogin(session);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '验证失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelTwoFa = () => {
    setPendingFlowToken(null);
    setTwoFaCode('');
    setErrorMessage(null);
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-3">
        {pendingFlowToken ? (
          <>
            <p className="text-xs leading-relaxed text-[var(--ink-soft)]">
              账号 <span className="font-mono">{username}</span> 已开启两步验证。
              请输入认证器 App 生成的 6 位动态码，或使用备用恢复码完成登录。
            </p>
            <form onSubmit={handleTwoFaSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--ink-soft)]">
                动态验证码
                <input
                  type="text"
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value)}
                  autoComplete="one-time-code"
                  autoFocus
                  inputMode="text"
                  className={inputClassAdmin}
                  placeholder="6 位动态码或备用码"
                />
              </label>

              {errorMessage && (
                <div className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                  <UiIcon name="alert-triangle" size={13} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="mt-1 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--paper)] transition-all hover:opacity-90 active:scale-[0.98] ${
                    isSubmitting ? 'cursor-not-allowed opacity-60' : ''
                  }`}
                >
                  <UiIcon name="lock" size={14} className={isSubmitting ? 'animate-pulse' : ''} />
                  <span>{isSubmitting ? '正在验证…' : '验证并登录'}</span>
                </button>
                <button
                  type="button"
                  onClick={cancelTwoFa}
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper-muted)] hover:text-[var(--ink)]"
                >
                  返回
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-[var(--ink-soft)]">
              使用 API 站点（<span className="font-mono">{domainDisplay}</span>）的管理员账号登录后，
              可进行公益站拓扑更新、渠道导入与最佳配置等管理操作。会话有效期与后端登录令牌一致（15 分钟）。
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--ink-soft)]">
                用户名
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className={inputClass}
                  placeholder="API 站管理员用户名"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--ink-soft)]">
                密码
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className={inputClass}
                  placeholder="API 站管理员密码"
                />
              </label>

              {errorMessage && (
                <div className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                  <UiIcon name="alert-triangle" size={13} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className={`mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--paper)] transition-all hover:opacity-90 active:scale-[0.98] ${
                  isSubmitting ? 'cursor-not-allowed opacity-60' : ''
                }`}
              >
                <UiIcon name="shield" size={14} className={isSubmitting ? 'animate-pulse' : ''} />
                <span>{isSubmitting ? '正在验证…' : '登录管理员'}</span>
              </button>
            </form>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <UiIcon name="shield" size={14} className="text-emerald-600" />
          <h2 className="text-sm font-semibold tracking-wide text-[var(--ink)]">管理中心</h2>
          <span className="rounded-full border border-emerald-200 bg-emerald-50/70 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
            {adminSession?.displayName || '管理员'}
          </span>
        </div>
        <p className="text-xs text-[var(--ink-soft)]">
          已登录 <span className="font-mono">{adminSession?.username}</span>（角色{' '}
          {adminSession?.role}），关联站点{' '}
          <span className="font-mono">{domainDisplay}</span>。当前 AI 公益站展示{' '}
          {stations.length} 个节点，管理操作全部集中在本页。
        </p>
      </div>

      <ApiSyncPanel
        endpoint={endpoint}
        onEndpointChange={onEndpointChange}
        isLoading={isLoading}
        error={error}
        statusData={statusData}
        modelCount={models.length}
        onRefresh={onRefresh}
        onOpenBestConfig={() => setIsBestConfigOpen(true)}
        onOpenImport={() => setIsImportModalOpen(true)}
        adminDisplayName={adminSession?.displayName}
        onAdminLogout={onAdminLogout}
      />

      <BestConfigModal
        isOpen={isBestConfigOpen}
        onClose={() => setIsBestConfigOpen(false)}
        analysis={topologyAnalysis}
        apiEndpoint={endpoint}
      />

      <StationImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        currentStations={stations}
        apiModels={models}
        apiEndpoint={endpoint}
        onUpdateStations={onPersistStations}
        onResetDefaults={onResetStations}
      />
    </div>
  );
};
