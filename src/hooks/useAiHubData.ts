import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AiStationItem as AiStationItemType } from '../types/ai-station';
import { ApiStationStatus, PublicStationChannel } from '../types/api-sync';
import {
  DEFAULT_API_STATION_URL,
  STORAGE_KEY_API_URL,
  STORAGE_KEY_CUSTOM_STATIONS,
  fetchApiStationConfig,
  fetchPublicStationChannels,
  loadManagedStations,
  mergePublicStations,
} from '../utils/api-station-sync';
import {
  AdminSession,
  clearAdminSession,
  isSessionActive,
  loadAdminSession,
  logoutAdmin,
  normalizeAdminBase,
  saveAdminSession,
  verifyAdminSession,
} from '../utils/admin-auth';

/**
 * App-level AI Hub state: the live channel topology from the API station is
 * needed by the whole page (nav badge, hero banner, stat button all show the
 * merged station count), so endpoint sync, station merge and admin session
 * live here instead of inside AiStationGrid.
 */
export function useAiHubData(initialStations: AiStationItemType[]) {
  // ---- API station endpoint & sync -------------------------------------
  const [endpoint, setEndpoint] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_API_URL) || DEFAULT_API_STATION_URL;
    }
    return DEFAULT_API_STATION_URL;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusData, setStatusData] = useState<ApiStationStatus | null>(null);
  const [models, setModels] = useState<string[]>([]);

  // Live channel topology published by the API station (GET /api/public_stations).
  // null = backend predates the endpoint → preset/local-only rendering.
  const [liveChannels, setLiveChannels] = useState<PublicStationChannel[] | null>(null);

  // ---- managed stations & merge -----------------------------------------
  const [managedStations, setManagedStations] = useState<AiStationItemType[]>(() =>
    loadManagedStations(initialStations)
  );
  const merged = useMemo(
    () => mergePublicStations(managedStations, liveChannels),
    [managedStations, liveChannels]
  );

  // Persists only locally-managed cards: upstream-* cards are derived from the
  // live feed on every load and must never leak into the localStorage store,
  // otherwise stale/removed origins would survive backend topology changes.
  const persistStations = useCallback((newStations: AiStationItemType[]) => {
    const managed = newStations.filter((s) => !s.id.startsWith('upstream-'));
    setManagedStations(managed);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_CUSTOM_STATIONS, JSON.stringify(managed));
      } catch (e) {
        console.error('Failed to save stations to localStorage:', e);
      }
    }
  }, []);

  const resetStations = useCallback(() => {
    setManagedStations(initialStations);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_CUSTOM_STATIONS);
    }
  }, [initialStations]);

  // ---- admin session ----------------------------------------------------
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const adminEpoch = useRef(0);
  // Ticks every 30s so an expired token flips the UI back to visitor mode
  // without waiting for the next state change.
  const [nowTick, setNowTick] = useState(() => Date.now());

  const isAdmin =
    !!adminSession &&
    isAdminVerified &&
    normalizeAdminBase(adminSession.baseUrl) === normalizeAdminBase(endpoint) &&
    isSessionActive(adminSession) &&
    nowTick > 0;

  // Restores a sessionStorage session once per endpoint. Only a server-side
  // rejection (401/403, role downgrade) clears the stored session; a network
  // failure keeps it so the admin regains access when connectivity returns.
  useEffect(() => {
    const epoch = ++adminEpoch.current;
    const session = loadAdminSession(endpoint);
    if (!session || !isSessionActive(session)) {
      if (session) clearAdminSession();
      setAdminSession(null);
      setIsAdminVerified(false);
      return;
    }
    setAdminSession(session);
    setIsAdminVerified(false);
    let cancelled = false;
    verifyAdminSession(session).then((result) => {
      if (cancelled || epoch !== adminEpoch.current) return;
      if (result === 'invalid') {
        clearAdminSession();
        setAdminSession(null);
      } else {
        setIsAdminVerified(result === 'valid');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  useEffect(() => {
    if (!adminSession) return;
    const timer = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [adminSession]);

  const handleAdminLogin = useCallback((session: AdminSession) => {
    adminEpoch.current++;
    saveAdminSession(session);
    setAdminSession(session);
    setIsAdminVerified(true);
    setNowTick(Date.now());
  }, []);

  const handleAdminLogout = useCallback(() => {
    adminEpoch.current++;
    if (adminSession) logoutAdmin(adminSession);
    clearAdminSession();
    setAdminSession(null);
    setIsAdminVerified(false);
  }, [adminSession]);

  // ---- sync (guarded against races) -------------------------------------
  const syncSeqRef = useRef(0);
  const syncWithApi = useCallback(async (targetUrl: string) => {
    const seq = ++syncSeqRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const [data, channels] = await Promise.all([
        fetchApiStationConfig(targetUrl),
        fetchPublicStationChannels(targetUrl).catch(() => null),
      ]);
      if (seq !== syncSeqRef.current) return; // superseded by a newer request
      setStatusData(data.status);
      setModels(data.models);
      setLiveChannels(channels);
      if (data.models.length === 0) {
        setError('已连接但未拉取到任何模型，请确认站点地址与接口可用性');
      }
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_API_URL, targetUrl);
        } catch (e) {
          console.warn('Failed to persist API URL:', e);
        }
      }
    } catch (err: unknown) {
      if (seq !== syncSeqRef.current) return;
      console.warn('API Station Sync Error:', err);
      setError(err instanceof Error ? err.message : '同步连接失败');
      setStatusData(null);
      setModels([]);
      setLiveChannels(null);
    } finally {
      if (seq === syncSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    syncWithApi(endpoint);
  }, [endpoint, syncWithApi]);

  const handleEndpointChange = useCallback(
    (newUrl: string) => {
      setEndpoint(newUrl);
    },
    []
  );

  return {
    // endpoint & sync
    endpoint,
    handleEndpointChange,
    isLoading,
    error,
    statusData,
    models,
    refresh: () => syncWithApi(endpoint),
    // stations
    stations: merged.stations,
    mergedMeta: { channelCount: merged.channelCount, upstreamCount: merged.upstreamCount },
    persistStations,
    resetStations,
    // admin
    adminSession,
    isAdmin,
    handleAdminLogin,
    handleAdminLogout,
  };
}
