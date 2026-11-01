import { AiStationItem } from '../types/ai-station';
import {
  ApiStationStatus,
  PricingModelItem,
  StationRecommendation,
  TopologyAnalysisResult,
  NewApiChannelPayload,
  RecommendedTier,
  PublicStationChannel,
} from '../types/api-sync';

export const DEFAULT_API_STATION_URL = 'https://api.mangoqwq.com';
export const STORAGE_KEY_API_URL = 'mangoshare_api_hub_linked_url';
export const STORAGE_KEY_CUSTOM_STATIONS = 'mangoshare_custom_ai_stations_v2';

// AiStationItem 联合类型字段的白名单，localStorage 缓存与备份还原共用：
// 缺失或非法值一律回退到括号里的默认分支。
export const VALID_CATEGORIES = ['NewAPI', 'Gateway', 'ImageGen', 'DirectKey'] as const;
export const VALID_AUTH_TYPES = ['LinuxDO', 'GitHub', 'Password', 'DirectKey', 'Session'] as const;
export const VALID_HEALTH_STATES = ['online', 'degraded', 'offline'] as const;

/**
 * Loads the user-managed station list from localStorage (v2 schema), falling
 * back to the bundled defaults. Used both by the ai-hub grid and by App-level
 * deep-link resolution so shared links to custom-imported stations keep working.
 */
export function loadManagedStations(defaults: AiStationItem[]): AiStationItem[] {
  if (typeof window === 'undefined') return defaults;
  try {
    // Clean legacy v1 cache to prevent stale shadowing
    localStorage.removeItem('mangoshare_custom_ai_stations');

    const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_STATIONS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const sanitized = parsed
          .filter((s) => s && typeof s === 'object' && s.name)
          .map((s) => ({
            // 必填展示字段兜底：v2 缓存只由本应用写入（导入/备份还原都会带上
            // 这些字段），但手改 localStorage 或未来 schema 演进可能留下缺字段
            // 的条目 —— 缺 quotaDesc/apiBaseUrl 会让卡片或弹窗渲染直接崩溃。
            ...s,
            category: VALID_CATEGORIES.includes(s.category) ? s.category : 'Gateway',
            authType: VALID_AUTH_TYPES.includes(s.authType) ? s.authType : 'LinuxDO',
            healthState: VALID_HEALTH_STATES.includes(s.healthState) ? s.healthState : 'online',
            portalUrl: typeof s.portalUrl === 'string' && s.portalUrl ? s.portalUrl : 'https://api.example.com',
            apiBaseUrl: typeof s.apiBaseUrl === 'string' && s.apiBaseUrl ? s.apiBaseUrl : 'https://api.example.com/v1',
            quotaDesc: typeof s.quotaDesc === 'string' && s.quotaDesc ? s.quotaDesc : '本地缓存条目',
            models: Array.isArray(s.models) ? s.models : [],
            tags: Array.isArray(s.tags) ? s.tags : [],
          }));
        if (sanitized.length > 0) {
          return sanitized as AiStationItem[];
        }
      }
    }
  } catch (e) {
    console.warn('Failed to parse cached stations:', e);
  }
  return defaults;
}

/**
 * Normalizes an API Base URL by trimming whitespace and removing trailing slashes.
 */
export function normalizeApiUrl(url: string): string {
  let cleaned = (url || '').trim();
  if (!cleaned) return DEFAULT_API_STATION_URL;
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }
  return cleaned.replace(/\/+$/, '');
}

/**
 * Categorizes an array of model names from our API station into standard architectural families.
 */
export function categorizeApiModels(models: string[]) {
  const claude: string[] = [];
  const gpt: string[] = [];
  const deepseek: string[] = [];
  const gemini: string[] = [];
  const vector: string[] = [];
  const image: string[] = [];
  const domestic: string[] = [];
  const openWeights: string[] = [];

  models.forEach((m) => {
    const lower = m.toLowerCase();
    if (lower.includes('bge') || lower.includes('embed') || lower.includes('rerank')) {
      vector.push(m);
    } else if (lower.includes('image') || lower.includes('flux') || lower.includes('video')) {
      image.push(m);
    } else if (lower.includes('claude')) {
      claude.push(m);
    } else if (lower.startsWith('gpt-') || lower.includes('codex') || lower.startsWith('o1') || lower.startsWith('o3')) {
      gpt.push(m);
    } else if (lower.includes('deepseek')) {
      deepseek.push(m);
    } else if (lower.includes('gemini')) {
      gemini.push(m);
    } else if (
      lower.includes('qwen') ||
      lower.includes('kimi') ||
      lower.includes('minimax') ||
      lower.includes('glm') ||
      lower.includes('sensenova') ||
      lower.startsWith('step-') ||
      lower.includes('space-bunny')
    ) {
      domestic.push(m);
    } else {
      openWeights.push(m);
    }
  });

  return { claude, gpt, deepseek, gemini, vector, image, domestic, openWeights };
}

/**
 * Fetches system status and configured models from a New API / One API / MangoApi endpoint.
 */
export async function fetchApiStationConfig(
  rawUrl: string,
  timeoutMs = 6000
): Promise<{ status: ApiStationStatus; models: string[] }> {
  const baseUrl = normalizeApiUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 1. Fetch system status
    const statusPromise = fetch(`${baseUrl}/api/status`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} from /api/status`);
      const json = await res.json();
      return json.data as ApiStationStatus;
    });

    // 2. Fetch pricing / models catalog
    const pricingPromise = fetch(`${baseUrl}/api/pricing`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} from /api/pricing`);
        const json = await res.json();
        if (Array.isArray(json.data)) {
          return (json.data as PricingModelItem[]).map((item) => item.model_name).filter(Boolean);
        }
        return null as string[] | null;
      })
      .catch(async (pricingErr: unknown) => {
        // Fallback with an independent timeout budget: the shared controller may
        // already be aborted by the time we get here (e.g. slow pricing endpoint).
        if (controller.signal.aborted) {
          return null;
        }
        const fallbackController = new AbortController();
        const fallbackTimer = setTimeout(() => fallbackController.abort(), timeoutMs);
        try {
          const fallbackRes = await fetch(`${baseUrl}/v1/models`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: fallbackController.signal,
          });
          if (fallbackRes.ok) {
            const fallbackJson = await fallbackRes.json();
            if (Array.isArray(fallbackJson.data)) {
              return fallbackJson.data
                .map((m: { id: string }) => m.id)
                .filter(Boolean) as string[];
            }
          }
          return null;
        } catch {
          return null;
        } finally {
          clearTimeout(fallbackTimer);
        }
      });

    // Resilient parallel retrieval: soft-fallback if /api/status is blocked
    const [statusResult, pricingResult] = await Promise.allSettled([statusPromise, pricingPromise]);

    const status: ApiStationStatus =
      statusResult.status === 'fulfilled'
        ? statusResult.value
        : { system_name: 'MangoApi / New API', version: '' };

    const rawModels: string[] | null | undefined =
      pricingResult.status === 'fulfilled' ? pricingResult.value : undefined;
    const models: string[] = Array.isArray(rawModels)
      ? rawModels.filter((m) => typeof m === 'string' && m.trim())
      : [];

    // Both channels failed (or the whole URL is unreachable): surface the failure
    // instead of silently reporting "success with 0 models".
    if (models.length === 0 && statusResult.status === 'rejected') {
      const reason = (statusResult as PromiseRejectedResult).reason;
      throw reason instanceof Error ? reason : new Error('无法连接目标 API 站点，请检查地址是否有效');
    }

    return { status, models };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Intelligently applies latest models from our API station to station items,
 * replacing obsolete model strings with our API site's real modern models.
 */
export function applyApiModelsToStations(apiModels: string[], stations: AiStationItem[]): AiStationItem[] {
  if (!apiModels || apiModels.length === 0) return stations;

  const cats = categorizeApiModels(apiModels);

  return stations.map((s) => {
    let freshModels: string[] = [];

    if (s.id === 'yiming') {
      freshModels = [
        cats.claude[0] || 'claude-sonnet-5',
        cats.gpt[0] || 'gpt-5.5',
        cats.deepseek[0] || 'deepseek-v4-pro',
        cats.gemini[0] || 'gemini-3.8-flash-high',
        cats.domestic[0] || 'qwen3.8-flash',
      ].filter(Boolean);
    } else if (s.id === 'amnew') {
      freshModels = [
        cats.gpt[1] || 'gpt-5.4',
        cats.claude[1] || 'claude-opus-5-thinking',
        cats.deepseek[1] || 'deepseek-v4-flash',
        cats.gpt.find((m) => m.includes('mini')) || 'gpt-5.4-mini',
      ].filter(Boolean);
    } else if (s.id === 'emrank') {
      freshModels = cats.vector.length > 0 ? cats.vector : ['bge-m3', 'bge-large-zh-v1.5', 'text-embedding-3-large'];
    } else if (s.id === 'ilovecat') {
      freshModels = [
        cats.claude[2] || 'claude-opus-5',
        cats.image[0] || 'gpt-image-2.5',
        cats.deepseek[0] || 'deepseek-v4-pro',
        cats.gpt[2] || 'gpt-5.2',
      ].filter(Boolean);
    } else if (s.id === '404api') {
      freshModels = [
        cats.deepseek[0] || 'deepseek-v4-pro',
        cats.deepseek[1] || 'deepseek-v4-flash',
        cats.gpt.find((m) => m.includes('astra')) || 'gpt-6-astra',
        cats.claude[0] || 'claude-sonnet-5',
      ].filter(Boolean);
    } else if (s.id === 'bohe') {
      freshModels = [
        cats.gpt[0] || 'gpt-5.5',
        cats.claude[0] || 'claude-sonnet-5',
        cats.gpt.find((m) => m.includes('luna')) || 'gpt-6-luna',
        cats.gemini.find((m) => m.includes('high')) || 'gemini-3.7-flash-high',
      ].filter(Boolean);
    } else if (s.id === 'pigeonw') {
      freshModels = [
        cats.gpt[1] || 'gpt-5.4',
        cats.claude[0] || 'claude-sonnet-5',
        cats.deepseek[1] || 'deepseek-v4-flash',
        cats.domestic[0] || 'qwen3.8-flash',
      ].filter(Boolean);
    } else if (s.id === 'darkforger') {
      freshModels = [
        cats.claude.find((m) => m.includes('thinking')) || 'claude-opus-5-thinking',
        cats.gpt[0] || 'gpt-5.5',
        cats.deepseek[0] || 'deepseek-v4-pro',
        cats.gpt.find((m) => m.includes('sol')) || 'gpt-6-sol',
      ].filter(Boolean);
    } else if (s.id === 'openrouter-free') {
      const freeModel = apiModels.find((m) => m.includes('openrouter') || m.includes('free'));
      freshModels = [
        freeModel || 'openrouter/free',
        'deepseek/deepseek-r1:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'qwen/qwen-2.5-72b-instruct:free',
      ];
    } else {
      // Custom or third-party imported station: map onto API models where possible.
      // Exact match first, then conservative prefix matching on the API side to
      // avoid fuzzy bidirectional substring hits mapping to wrong variants.
      freshModels = s.models.map((m) => {
        const lower = m.toLowerCase().trim();
        if (!lower) return '';
        const exact = apiModels.find((apiM) => apiM.toLowerCase() === lower);
        if (exact) return exact;
        if (lower.length >= 3) {
          const prefixed = apiModels.find((apiM) => apiM.toLowerCase().startsWith(lower));
          if (prefixed) return prefixed;
        }
        return m;
      }).filter(Boolean);
    }

    return {
      ...s,
      models: freshModels.length > 0 ? freshModels : s.models,
    };
  });
}

/**
 * Cross-references existing API models against curated public stations to produce an optimal topology.
 * Strictly uses our API site's real models. No emojis in generated text.
 */
export function analyzeTopology(
  existingModels: string[],
  stations: AiStationItem[]
): TopologyAnalysisResult {
  const recommendations: StationRecommendation[] = [];
  const coveredSet = new Set<string>();

  // Use the stations as the user sees them in the grid so that topology
  // recommendations, displayed models and exported channel JSON stay consistent.
  // (Explicit re-mapping is only performed by the "Apply API Models" action.)
  const syncedStations = stations;

  syncedStations.forEach((station) => {
    let tier: RecommendedTier = 'bonus_lottery';
    let tierBadge = '特色补充';
    let tierName = '梯队四 · 福利活动与特色网关';
    let reason = '适合作为日常备选渠道或签到额度补充池';
    let priority = 6;
    let weight = 1;
    let testModel = station.models[0] || 'gpt-5.4-mini';

    // Tier 1: Primary High-Availability Nodes
    if (station.id === 'yiming' || station.id === 'amnew') {
      tier = 'primary_ha';
      tierBadge = '主力高可用';
      tierName = '梯队一 · 主力核心高可用免费中继';
      priority = station.id === 'yiming' ? 10 : 9;
      weight = 2;
      reason = '覆盖核心旗舰模型（Claude Sonnet 5、GPT-5.5、DeepSeek-V4 Pro），免翻低延迟，作为主力免费分流通道';
      testModel = station.models.find((m) => m.startsWith('gpt-') || m.startsWith('claude-')) || station.models[0];
    }
    // Tier 2: Dedicated Vector & RAG Embedding/Rerank
    else if (station.id === 'emrank' || station.tags.some((t) => t.includes('RAG') || t.includes('向量'))) {
      tier = 'vector_rag';
      tierBadge = '向量专精';
      tierName = '梯队二 · 知识库与向量检索专精池';
      priority = 10;
      weight = 1;
      reason = '专精提供 BGE 与高并发向量检索能力，单日免费 1,000,000 M Tokens，承接知识库检索流量';
      testModel = station.models.find((m) => m.includes('bge')) || station.models[0];
    }
    // Tier 3: Permanent Zero-Cost Open Source Fallback Pool
    else if (station.id === 'openrouter-free' || station.category === 'DirectKey') {
      tier = 'free_fallback';
      tierBadge = '开源保底';
      tierName = '梯队三 · 永久零成本开源保底池';
      priority = 5;
      weight = 1;
      reason = '全球路由平台免费档，永久 0 成本承接开源大模型请求，提供不掉线兜底保障';
      testModel = 'openrouter/free';
    }
    // Tier 4: High Bonus / Special Gateway
    else if (station.id === 'bohe' || station.id === '404api' || station.id === 'ilovecat' || station.id === 'darkforger') {
      tier = 'bonus_lottery';
      tierBadge = '特色补充';
      tierName = '梯队四 · 高额福利与特色补充网关';
      priority = 7;
      weight = 1;
      reason = station.quotaDesc;
      testModel = station.models[0] || 'gpt-5.4';
    }

    // Matched models calculation using actual API station models
    const matchedExisting = station.models.filter((m) => existingModels.includes(m));
    const expandedNew = station.models.filter((m) => !existingModels.includes(m));

    matchedExisting.forEach((m) => coveredSet.add(m));

    recommendations.push({
      station,
      tier,
      tierBadge,
      tierName,
      reason,
      recommendedPriority: priority,
      recommendedWeight: weight,
      recommendedModels: station.models,
      testModel,
      matchedExistingModels: matchedExisting,
      expandedNewModels: expandedNew,
    });
  });

  // Sort recommendations by Tier (primary_ha -> vector_rag -> free_fallback -> bonus_lottery) then priority
  const tierOrder: Record<RecommendedTier, number> = {
    primary_ha: 1,
    vector_rag: 2,
    free_fallback: 3,
    bonus_lottery: 4,
  };

  recommendations.sort((a, b) => {
    const diffTier = tierOrder[a.tier] - tierOrder[b.tier];
    if (diffTier !== 0) return diffTier;
    return b.recommendedPriority - a.recommendedPriority;
  });

  const coveredCount = coveredSet.size;
  const summary = `已基于 API 站点当前运行的 ${existingModels.length} 个最新模型完成分析，推荐接入 ${recommendations.length} 个公益站节点构建四级分流拓扑，实现主力旗舰模型主备双活容灾与向量开源算力扩展。`;

  return {
    existingModelCount: existingModels.length,
    coveredByPublicStations: Array.from(coveredSet),
    gapModelsCount: Math.max(0, existingModels.length - coveredCount),
    recommendations,
    summary,
  };
}

/**
 * Converts a station and recommendation into a New API / One API channel creation payload.
 */
export function generateNewApiChannelJson(
  station: AiStationItem,
  rec?: Partial<StationRecommendation>,
  apiKey?: string
): NewApiChannelPayload {
  // Strip /v1 style suffixes: the relay engine concatenates the request path
  // itself, so base_url must stay a bare origin+prefix.
  const normalizedBaseUrl = station.apiBaseUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/v1$/, '');

  // Channel types verified against New API Go source (constant/channel.go):
  // - 60 = New API protocol (auto sync / relay compatible)
  // - 20 = OpenRouter (Go built-in default base url is origin w/o /v1)
  // - 1  = OpenAI compatible: GetFullRequestURL(baseUrl, "/v1/chat/completions")
  // Type 8 is the *Custom template* channel whose URL is used verbatim
  // ({model} placeholder only) — it must NOT be used for bare origins.
  let channelType = 1;
  if (station.id === 'openrouter-free') {
    channelType = 20;
  } else if (station.category === 'NewAPI') {
    channelType = 60;
  }

  const modelList = (rec?.recommendedModels || station.models)
    .map((m) => m.trim())
    .filter(Boolean);
  const modelsStr = modelList.join(',');

  const fallbackTestModel = modelList[0] || null;
  const testModel = rec?.testModel || fallbackTestModel;
  const priority = rec?.recommendedPriority ?? 10;
  const weight = rec?.recommendedWeight ?? 1;

  return {
    mode: 'single',
    channel: {
      name: `[公益] ${station.name}`,
      type: channelType,
      key: (apiKey || '').trim() || 'sk-your-upstream-token-here',
      base_url: normalizedBaseUrl,
      models: modelsStr,
      group: 'default',
      priority,
      weight,
      status: 1,
      auto_ban: 1,
      test_model: testModel,
      tag: 'mangoshare-public',
      remark: `Auto-generated from mangoshare ai-hub (${station.id})`,
      setting: JSON.stringify({
        proxy: '',
        http_protocol: 'auto',
        http2_connection_shards: 1,
        max_inflight: 0,
        pass_through_body_enabled: false,
        responses_websocket_enabled: false,
      }),
      settings: JSON.stringify({
        allow_service_tier: false,
        disable_store: false,
        upstream_model_update_check_enabled: false,
        upstream_model_update_auto_sync_enabled: false,
      }),
    },
  };
}

/**
 * Generates batch New API JSON for multiple recommended stations.
 */
export function generateBatchNewApiImportJson(
  recommendations: StationRecommendation[],
  keyPlaceholder = 'sk-your-upstream-token-here'
): NewApiChannelPayload[] {
  return recommendations.map((rec) => generateNewApiChannelJson(rec.station, rec, keyPlaceholder));
}

/**
 * Escapes a string for safe interpolation into a POSIX shell double-quoted
 * segment: backslash, double quote, backtick and $ must all be escaped so
 * user-controlled values (endpoint URLs, channel names from third-party JSON)
 * can never escalate into command execution.
 */
function shellEscapeDoubleQuoted(value: string): string {
  return value.replace(/[\\"`$]/g, (c) => `\\${c}`);
}

/**
 * Builds the multi-channel terminal bootstrap script used by BestConfigModal.
 * Single source of truth so escaping rules can never drift between copies.
 */
export function generateChannelsBatchCurlScript(
  recommendations: StationRecommendation[],
  apiStationUrl: string,
  keyPlaceholder = 'sk-your-upstream-token-here'
): string {
  const apiBase = apiStationUrl.replace(/\/+$/, '');
  const escapedApiBase = shellEscapeDoubleQuoted(apiBase);

  const sections = recommendations.map((rec) => {
    const payload = generateNewApiChannelJson(rec.station, rec, keyPlaceholder);
    const bodyStr = JSON.stringify(payload);
    return `# [${rec.tierBadge}] ${rec.station.name} (Priority: ${rec.recommendedPriority})
curl -s -X POST "\${API_BASE}/api/channel/" \\
  -H "Authorization: Bearer \${ADMIN_TOKEN}" \\
  -H "Content-Type: application/json" \\
  -d '${bodyStr.replace(/'/g, "'\\''")}'
echo " -> submitted: ${shellEscapeDoubleQuoted(rec.station.name)}"
`;
  }).join('\n');

  return `#!/usr/bin/env bash
# MangoApi / New API channel batch bootstrap script
# Target station base: ${escapedApiBase}
# Generated at: ${new Date().toISOString()}

API_BASE="${escapedApiBase}"
ADMIN_TOKEN="\${NEWAPI_ADMIN_TOKEN:-'YOUR_NEWAPI_ADMIN_KEY'}"

echo "Injecting recommended public relay topology into \${API_BASE} ..."

${sections}
echo "Topology import finished. Run channel tests from the admin console to verify liveness."
`;
}

// UTF-16 code units encode reversibly into URL-safe characters, including unusual URLs.
function identitySuffix(value: string): string {
  return Array.from({ length: value.length }, (_, i) => value.charCodeAt(i).toString(16).padStart(4, '0')).join('');
}

export function appendImportedStations(current: AiStationItem[], incoming: AiStationItem[]): AiStationItem[] {
  const urls = new Set(current.map(s => s.apiBaseUrl.toLowerCase().replace(/\/+$/, '')));
  const names = new Set(current.map(s => s.name.trim().toLowerCase()));
  const ids = new Set(current.map(s => s.id));
  const added: AiStationItem[] = [];
  for (const station of incoming) {
    const url = station.apiBaseUrl.toLowerCase().replace(/\/+$/, '');
    const name = station.name.trim().toLowerCase();
    if (urls.has(url) || names.has(name)) continue;
    let id = station.id;
    while (ids.has(id)) id += '-';
    ids.add(id); urls.add(url); names.add(name);
    added.push(id === station.id ? station : { ...station, id });
  }
  return [...added, ...current];
}

/**
 * Parses New API channel JSON (single channel object or array of channels from /api/channel/ or manual backup),
 * converting them into AiStationItem format for systematic import into mangoshare.
 */
export function parseNewApiChannelsJson(rawJson: string): AiStationItem[] {
  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err: any) {
    throw new Error(`JSON 解析失败: ${err?.message || '请检查格式是否有效'}`);
  }

  // Handle { success: true, data: [...] } envelope from New API API responses
  let items: any[] = [];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && Array.isArray(parsed.data)) {
    items = parsed.data;
  } else if (parsed && parsed.channel) {
    items = [parsed.channel];
  } else if (parsed && typeof parsed === 'object') {
    items = [parsed];
  }

  if (items.length === 0) {
    throw new Error('未在 JSON 中找到有效的渠道配置记录');
  }

  return items.map((item, index) => {
    const rawName = String(item.name || `导入渠道 ${index + 1}`).trim();
    const cleanName = rawName.replace(/^\[.*?\]\s*/, '');
    // tag 可能为数字或其它 truthy 非字符串值，必须先归一化为字符串
    const rawTag = item.tag == null ? '' : String(item.tag).trim();
    const baseSlug = (
      rawTag ||
      cleanName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 24) ||
      `channel-${index + 1}`
    ).replace(/^-+|-+$/g, '');
    const id = `custom-${baseSlug}-${index + 1}-${identitySuffix(String(item.base_url || '').trim())}`;

    const rawBaseUrlInput = item.base_url == null ? '' : String(item.base_url).trim();
    if (!rawBaseUrlInput) {
      throw new Error(`渠道「${cleanName}」未配置 base_url，无法导入（请先在源站点补全后再导入）`);
    }
    let rawBaseUrl = rawBaseUrlInput;
    if (!rawBaseUrl.startsWith('http://') && !rawBaseUrl.startsWith('https://')) {
      rawBaseUrl = 'https://' + rawBaseUrl;
    }
    const cleanBaseUrl = rawBaseUrl.replace(/\/+$/, '');
    const apiBaseUrl = cleanBaseUrl.endsWith('/v1') ? cleanBaseUrl : `${cleanBaseUrl}/v1`;

    const models = typeof item.models === 'string'
      ? item.models.split(',').map((m: string) => m.trim()).filter(Boolean)
      : Array.isArray(item.models)
      ? item.models
          .filter((m: unknown) => m != null && typeof m !== 'object' && String(m).trim() !== '')
          .map((m: unknown) => String(m).trim())
      : ['gpt-5.5'];

    const typeNum = Number(item.type);
    let category: AiStationItem['category'] = 'Gateway';
    if (typeNum === 60) category = 'NewAPI';
    else if (typeNum === 20) category = 'DirectKey';
    // DirectKey 类渠道（如 OpenRouter）不走 Linux.do 授权，否则「Linux.do」
    // 筛选标签会把它们错误地收进来。
    const authType: AiStationItem['authType'] = category === 'DirectKey' ? 'DirectKey' : 'LinuxDO';

    return {
      id,
      name: cleanName,
      category,
      portalUrl: cleanBaseUrl,
      apiBaseUrl,
      models: models.length > 0 ? models : ['gpt-5.5'],
      authType,
      quotaDesc: item.remark || '从 New API 渠道配置系统性导入',
      healthState: Number(item.status) === 1 ? 'online' : Number(item.status) === 2 ? 'degraded' : 'offline',
      turnstile: false,
      tags: ['已导入', category, `优先级 ${item.priority || 0}`],
      tutorial: '通过渠道配置一键导入，可在客户端使用对应 Base URL 与令牌进行请求。',
      rpmLimit: item.setting ? '已配置流控' : '30 RPM',
    };
  });
}

/**
 * Fetches the deployment's published station topology (channels tagged or
 * allowed for public display by PUBLIC_STATIONS_MODE on the API station).
 * Returns null when the backend predates the endpoint (404) so callers can
 * fall back to preset-only rendering.
 */
export async function fetchPublicStationChannels(
  rawUrl: string,
  timeoutMs = 6000
): Promise<PublicStationChannel[] | null> {
  const baseUrl = normalizeApiUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/api/public_stations`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || !Array.isArray(json.data)) return null;
    return (json.data as PublicStationChannel[]).filter(
      (ch) =>
        ch &&
        typeof ch === 'object' &&
        typeof ch.name === 'string' &&
        typeof ch.base_url === 'string'
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normalizes a channel base_url to its bare origin for card matching:
 * trims whitespace/trailing slashes, drops a trailing /v1, keeps the rest.
 */
function canonicalUpstreamOrigin(raw: string): string {
  let cleaned = (raw || '').trim().replace(/\/+$/, '');
  if (!cleaned) return '';
  cleaned = cleaned.replace(/\/v1$/, '');
  return cleaned;
}

function channelCategory(type: number): AiStationItem['category'] {
  if (type === 60) return 'NewAPI';
  if (type === 20) return 'DirectKey';
  return 'Gateway';
}

function healthFromStatus(status: number): AiStationItem['healthState'] {
  return status === 1 ? 'online' : status === 2 ? 'degraded' : 'offline';
}

export interface MergedStationResult {
  stations: AiStationItem[];
  /** Unique upstream origins represented in the merged grid. */
  upstreamCount: number;
  /** Channels that arrived from the API station backend. */
  channelCount: number;
}

/**
 * Merges the API station's live channel topology into the station list:
 * - presets whose portal/api origin matches a channel are upgraded with the
 *   backend's real model list, latency and health;
 * - origins with no preset become additional cards (deterministic id
 *   `upstream-<hostslug>` so deep links survive reloads while the fetch is
 *   fresh);
 * - multiple channels on one origin collapse into a single card whose models
 *   are the union and whose tags carry the channel count.
 */
export function mergePublicStations(
  presets: AiStationItem[],
  channels: PublicStationChannel[] | null
): MergedStationResult {
  if (!channels || channels.length === 0) {
    return { stations: presets, upstreamCount: presets.length, channelCount: 0 };
  }

  // Aggregate channels by canonical origin.
  const byOrigin = new Map<
    string,
    { name: string; models: Set<string>; channelCount: number; type: number; latency: number }
  >();
  for (const ch of channels) {
    const origin = canonicalUpstreamOrigin(ch.base_url);
    if (!origin) continue;
    const existing = byOrigin.get(origin);
    const models = new Set(ch.models || []);
    if (existing) {
      models.forEach((m) => existing.models.add(m));
      existing.channelCount += 1;
      existing.latency =
        existing.latency > 0 && ch.response_time > 0
          ? Math.min(existing.latency, ch.response_time)
          : Math.max(existing.latency, ch.response_time);
    } else {
      byOrigin.set(origin, {
        name: ch.name,
        models,
        channelCount: 1,
        type: ch.type,
        latency: ch.response_time,
      });
    }
  }

  const presetOriginOf = (s: AiStationItem) =>
    canonicalUpstreamOrigin(s.apiBaseUrl) ||
    canonicalUpstreamOrigin(s.portalUrl);

  const merged = presets.map((preset) => {
    const origin = presetOriginOf(preset);
    const entry = origin ? byOrigin.get(origin) : undefined;
    if (!entry) return preset;
    return {
      ...preset,
      models: entry.models.size > 0 ? Array.from(entry.models) : preset.models,
      // A historical response time does not establish current health.
      healthState: preset.healthState,
      responseTime: entry.latency > 0 ? entry.latency : undefined,
      tags: Array.from(new Set([...preset.tags, `API站已接入`, `${entry.channelCount} 渠道`])),
    };
  });

  const presetOrigins = new Set(merged.map(presetOriginOf));
  const extras: AiStationItem[] = [];
  const usedIds = new Set(merged.map((station) => station.id));
  for (const [origin, entry] of [...byOrigin].sort(([a], [b]) => a.localeCompare(b))) {
    if (presetOrigins.has(origin)) continue;
    // Slug from the full origin (not just hostname): distinct origins that
    // share a host (e.g. https://a.b and https://a.b/claude) must not collide.
    const hostSlug = origin
      .replace(/^https?:\/\//, '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'station';
    const category = channelCategory(entry.type);
    const legacyId = `upstream-${hostSlug}`;
    let id = legacyId;
    if (usedIds.has(id)) id = `${legacyId}-${identitySuffix(origin)}`;
    while (usedIds.has(id)) id += '-';
    usedIds.add(id);
    extras.push({
      id,
      name: entry.name,
      category,
      portalUrl: origin,
      apiBaseUrl: `${origin}/v1`,
      models: Array.from(entry.models),
      authType: category === 'DirectKey' ? 'DirectKey' : 'Session',
      quotaDesc: `API 站已接入 · ${entry.channelCount} 渠道 · 优先级 1-10`,
      healthState: 'degraded',
      responseTime: entry.latency > 0 ? entry.latency : undefined,
      turnstile: false,
      tags: ['动态下发', category, entry.channelCount > 1 ? `${entry.channelCount} 渠道` : '单渠道'],
      tutorial: '该站点通过 API 站渠道动态接入，模型清单实时来自后台配置。',
    });
  }

  return {
    stations: [...merged, ...extras],
    upstreamCount: byOrigin.size,
    channelCount: channels.length,
  };
}
