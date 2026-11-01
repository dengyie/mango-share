import React, { useState, useEffect, useRef } from 'react';
import { AiStationItem } from '../../types/ai-station';
import {
  applyApiModelsToStations,
  appendImportedStations,
  parseNewApiChannelsJson,
  VALID_AUTH_TYPES,
  VALID_CATEGORIES,
  VALID_HEALTH_STATES,
} from '../../utils/api-station-sync';
import { copyToClipboard } from '../../utils/clipboard';
import { useModalLock } from '../../utils/use-modal-lock';
import { UiIcon } from '../awesome-ui/UiIcon';

interface StationImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStations: AiStationItem[];
  apiModels: string[];
  apiEndpoint: string;
  onUpdateStations: (newStations: AiStationItem[]) => void;
  onResetDefaults: () => void;
}

export const StationImportModal: React.FC<StationImportModalProps> = ({
  isOpen,
  onClose,
  currentStations,
  apiModels,
  apiEndpoint,
  onUpdateStations,
  onResetDefaults,
}) => {
  const [activeTab, setActiveTab] = useState<'api_sync' | 'channel_json' | 'backup'>('api_sync');
  const [channelJsonInput, setChannelJsonInput] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [backupJsonInput, setBackupJsonInput] = useState('');

  // Timer management: clear previous timers so quick successive actions never
  // erase a newer notification, and no setState happens after unmount.
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeGuardRef = useRef<() => void>(() => {});

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  // ESC 关闭 + 背景滚动锁定。经 ref 中转，让守卫逻辑（未提交内容先 confirm）
  // 定义在早退之后也能被 ESC 路径复用。
  useModalLock(isOpen, () => closeGuardRef.current());

  if (!isOpen) return null;

  const showNotification = (msg: string) => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    setSuccessMessage(msg);
    setErrorMessage(null);
    successTimerRef.current = setTimeout(() => setSuccessMessage(null), 3000);
  };

  // 1. One-click apply modern API models to all current stations
  const handleApplyApiModels = () => {
    if (!apiModels || apiModels.length === 0) {
      setErrorMessage('未检测到已拉取的 API 站点模型，请先检查 API 站点连接状态');
      return;
    }
    const updated = applyApiModelsToStations(apiModels, currentStations);
    onUpdateStations(updated);
    showNotification(`已成功将 ${apiModels.length} 款 API 站点最新模型映射更新至全量公益站`);
  };

  // 2. Import New API Channels from JSON
  const handleImportNewApiChannels = () => {
    if (!channelJsonInput.trim()) {
      setErrorMessage('请输入或粘贴 New API 渠道配置 JSON 内容');
      return;
    }
    try {
      setErrorMessage(null);
      const parsedStations = parseNewApiChannelsJson(channelJsonInput.trim());
      const base = importMode === 'replace' ? [] : currentStations;
      const resultStations = appendImportedStations(base, parsedStations);
      onUpdateStations(resultStations);
      setChannelJsonInput('');
      showNotification(`已成功导入 ${resultStations.length - base.length} 个渠道节点`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : '解析失败，请检查 New API 渠道 JSON 格式');
    }
  };

  // 3. Export backup JSON
  const handleCopyBackupJson = async () => {
    const jsonStr = JSON.stringify(currentStations, null, 2);
    const success = await copyToClipboard(jsonStr);
    if (success) {
      setCopiedBackup(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedBackup(false), 2000);
    }
  };

  // 4. Restore backup JSON with full defensive sanitization (union-type whitelists)
  const handleRestoreBackupJson = () => {
    if (!backupJsonInput.trim()) {
      setErrorMessage('请输入完整的备份配置 JSON 内容');
      return;
    }
    try {
      setErrorMessage(null);
      const parsed = JSON.parse(backupJsonInput.trim());
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('备份数据必须是非空的节点数组');
      }

      const validStations: AiStationItem[] = parsed
        .filter((item): item is Partial<AiStationItem> => Boolean(item && typeof item === 'object' && item.name))
        .map((item, idx) => {
          const category = VALID_CATEGORIES.includes(item.category as typeof VALID_CATEGORIES[number])
            ? (item.category as AiStationItem['category'])
            : 'Gateway';
          const rawAuth = item.authType as string | undefined;
          const authType = VALID_AUTH_TYPES.includes(rawAuth as typeof VALID_AUTH_TYPES[number])
            ? (rawAuth as AiStationItem['authType'])
            : 'LinuxDO';
          const rawHealth = item.healthState as string | undefined;
          const healthState = VALID_HEALTH_STATES.includes(rawHealth as typeof VALID_HEALTH_STATES[number])
            ? (rawHealth as AiStationItem['healthState'])
            : 'online';
          const models = Array.isArray(item.models)
            ? item.models
                .filter((m: unknown) => m != null && typeof m !== 'object' && String(m).trim() !== '')
                .map((m: unknown) => String(m).trim())
            : [];
          const tags = Array.isArray(item.tags)
            ? item.tags.map(String).filter(Boolean)
            : [];

          return {
            id: String(item.id || `restored-${idx + 1}`),
            name: String(item.name).trim(),
            category,
            portalUrl: String(item.portalUrl || item.apiBaseUrl || 'https://api.example.com').trim(),
            apiBaseUrl: String(item.apiBaseUrl || item.portalUrl || 'https://api.example.com/v1').trim(),
            models: models.length > 0 ? models : ['gpt-5.5', 'claude-sonnet-5'],
            authType,
            quotaDesc: String(item.quotaDesc || '从备份恢复的节点配置'),
            statusEndpoint: item.statusEndpoint ? String(item.statusEndpoint) : undefined,
            healthState,
            turnstile: Boolean(item.turnstile),
            tags: tags.length > 0 ? tags : ['已恢复'],
            tutorial: item.tutorial ? String(item.tutorial) : undefined,
            balance: item.balance ? String(item.balance) : undefined,
            rpmLimit: item.rpmLimit ? String(item.rpmLimit) : undefined,
          } as AiStationItem;
        });

      // Same business-level dedup as channel import: keep the first occurrence
      const seenIds = new Set<string>();
      const deduped = validStations.filter((s) => {
        if (seenIds.has(s.id)) return false;
        seenIds.add(s.id);
        return true;
      });

      if (deduped.length === 0) {
        throw new Error('备份数据中未检测到符合规范的公益站节点对象');
      }

      onUpdateStations(deduped);
      setBackupJsonInput('');
      showNotification(`已成功还原 ${deduped.length} 个站点的完整配置`);
    } catch (err: unknown) {
      setErrorMessage(`还原失败: ${err instanceof Error ? err.message : 'JSON 格式有误'}`);
    }
  };

  // 5. Reset to factory defaults
  const handleResetToFactory = () => {
    if (window.confirm('确认恢复为官方预设的公益站列表配置吗？自定义导入的节点将被重置。')) {
      onResetDefaults();
      showNotification('已成功重置为官方预设配置');
    }
  };

  // Guard overlay / ESC dismissal when there is un-submitted editor content,
  // so a stray click can never silently discard large pasted JSON. Assigned
  // after the early return, invoked through the ref inside useModalLock.
  const handleRequestClose = () => {
    if (channelJsonInput.trim() || backupJsonInput.trim()) {
      if (window.confirm('当前存在未提交的粘贴内容，确定要关闭并丢弃吗？')) {
        onClose();
      }
      return;
    }
    onClose();
  };
  closeGuardRef.current = handleRequestClose;

  return (
    <div className="modal-overlay" onClick={handleRequestClose}>
      <div
        className="modal-sheet !max-w-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header */}
        <div className="topbar">
          <button className="back-btn" onClick={handleRequestClose} type="button">
            <UiIcon name="arrow-left" size={14} strokeWidth={2.2} />
            <span>返回公益站列表</span>
          </button>
          <div className="flex items-center gap-1.5 text-xs text-[var(--ink-soft)] font-mono">
            <span>{apiEndpoint}</span>
          </div>
        </div>

        {/* Modal Title */}
        <div className="card-title flex items-center gap-2">
          <UiIcon name="server" size={18} className="text-[var(--ink)]" />
          <span>公益站系统化导入与更新中心</span>
        </div>
        <p className="mt-1 text-xs text-[var(--ink-soft)] leading-relaxed">
          集中管理、更新与同步站点数据。支持直接回写 API 站点最新模型架构、导入 New API 渠道配置，或备份迁移完整列表。
        </p>

        {/* Alert Notifications */}
        {successMessage && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            <UiIcon name="check" size={13} className="text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            <UiIcon name="alert-triangle" size={13} className="text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mt-4 flex flex-wrap gap-1.5 border-b border-[var(--line)] pb-2 text-xs">
          <button
            type="button"
            className={`pill !h-8 !px-3 text-xs ${activeTab === 'api_sync' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('api_sync');
              setErrorMessage(null);
            }}
          >
            <UiIcon name="refresh" size={12} className="mr-1 inline" />
            同步 API 站最新模型
          </button>
          <button
            type="button"
            className={`pill !h-8 !px-3 text-xs ${activeTab === 'channel_json' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('channel_json');
              setErrorMessage(null);
            }}
          >
            <UiIcon name="code" size={12} className="mr-1 inline" />
            导入 New API 渠道配置
          </button>
          <button
            type="button"
            className={`pill !h-8 !px-3 text-xs ${activeTab === 'backup' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('backup');
              setErrorMessage(null);
            }}
          >
            <UiIcon name="layers" size={12} className="mr-1 inline" />
            配置备份与重置
          </button>
        </div>

        {/* Tab 1: Sync Live API Models */}
        {activeTab === 'api_sync' && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm text-[var(--ink)]">
                    从关联 API 站点继承最新模型库
                  </h4>
                  <p className="mt-1 text-xs text-[var(--ink-soft)]">
                    当前已连接: <code className="font-mono text-[var(--ink)]">{apiEndpoint}</code>
                  </p>
                </div>
                <div className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 border border-emerald-200">
                  {apiModels.length} 款可用模型
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--paper-soft)] p-3 text-xs">
                <div className="text-[11px] font-medium text-[var(--ink-soft)] uppercase tracking-wider">
                  已就绪的前沿模型样本:
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5 font-mono text-[11px] text-[var(--ink)]">
                  {apiModels.slice(0, 8).map((m) => (
                    <span key={m} className="rounded bg-[var(--paper)] px-2 py-0.5 border border-[var(--line)]">
                      {m}
                    </span>
                  ))}
                  {apiModels.length > 8 && (
                    <span className="rounded bg-[var(--paper)] px-2 py-0.5 text-[var(--ink-soft)] border border-[var(--line)]">
                      +{apiModels.length - 8} 更多
                    </span>
                  )}
                </div>
              </div>

              <p className="mt-3 text-xs text-[var(--ink-soft)] leading-relaxed">
                点击下方按钮将把 API 站点的全套最新一代模型（GPT-5.5、Claude Sonnet 5、DeepSeek-V4、Gemini 3.8、BGE-M3 等）智能分发应用到所有公益站节点中，全面淘汰旧模型。
              </p>

              <div className="mt-4 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleApplyApiModels}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2 text-xs font-medium text-[var(--paper)] hover:opacity-90 active:scale-95 transition-all"
                >
                  <UiIcon name="check" size={13} />
                  <span>立即应用 API 站最新模型到全部节点</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: New API Channel Import */}
        {activeTab === 'channel_json' && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--ink-soft)]">
                粘贴从 New API 渠道导出的单个或批量渠道 JSON：
              </span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                    className="accent-[var(--ink)]"
                  />
                  <span>追加到现有列表</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="accent-[var(--ink)]"
                  />
                  <span>全新覆盖</span>
                </label>
              </div>
            </div>

            <textarea
              rows={8}
              value={channelJsonInput}
              onChange={(e) => setChannelJsonInput(e.target.value)}
              placeholder='[&#10;  {&#10;    "name": "公益站示例",&#10;    "type": 60,&#10;    "base_url": "https://api.example.com",&#10;    "models": "claude-sonnet-5,gpt-5.5"&#10;  }&#10;]'
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--paper-soft)] p-3 font-mono text-xs text-[var(--ink)] outline-none focus:border-[var(--ink)] leading-relaxed"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-[var(--ink-soft)]">
                兼容 New API <code>/api/channel/</code> 导出格式及单个渠道创建 Payload。
              </span>
              <button
                type="button"
                onClick={handleImportNewApiChannels}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2 text-xs font-medium text-[var(--paper)] hover:opacity-90 active:scale-95 transition-all"
              >
                <UiIcon name="code" size={13} />
                <span>确认解析并导入渠道</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Backup & Restore */}
        {activeTab === 'backup' && (
          <div className="mt-4 space-y-4">
            {/* Export Section */}
            <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-xs text-[var(--ink)]">备份当前节点数据</h4>
                  <p className="text-[11px] text-[var(--ink-soft)]">
                    当前列表中共包含 {currentStations.length} 个公益站 / 自建中转节点配置
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyBackupJson}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--paper)] transition-all ${
                    copiedBackup ? 'bg-emerald-600' : 'bg-[var(--ink)] hover:opacity-90'
                  }`}
                >
                  <UiIcon name={copiedBackup ? 'check' : 'copy'} size={12} />
                  <span>{copiedBackup ? '已复制备份 JSON' : '复制完整备份配置'}</span>
                </button>
              </div>
            </div>

            {/* Restore Section */}
            <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3.5">
              <h4 className="font-medium text-xs text-[var(--ink)]">从备份 JSON 还原</h4>
              <textarea
                rows={4}
                value={backupJsonInput}
                onChange={(e) => setBackupJsonInput(e.target.value)}
                placeholder="粘贴之前复制的完整配置 JSON 数组..."
                className="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--paper-soft)] p-2.5 font-mono text-xs text-[var(--ink)] outline-none focus:border-[var(--ink)] leading-relaxed"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleRestoreBackupJson}
                  className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-xs text-[var(--ink)] hover:bg-[var(--paper-soft)]"
                >
                  还原备份数据
                </button>
              </div>
            </div>

            {/* Factory Reset Section */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 dark:border-rose-900/40 dark:bg-rose-950/20">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-xs text-rose-800 dark:text-rose-300">恢复出厂预设</h4>
                  <p className="text-[11px] text-rose-700/80 dark:text-rose-400">
                    清除本地自定义导入与修改记录，还原为官方精选预设列表
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetToFactory}
                  className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                >
                  恢复官方预设
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
