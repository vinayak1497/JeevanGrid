/**
 * Shared AI assistant state.
 *
 * Lives above the router's routes so the floating panel on the landing page
 * and the full-page /assistant view talk to the same conversation. Neither
 * view owns its own copy of messages, so switching modes never loses history.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiFetch } from '../api/client';
import { useLanguage } from '../i18n/LanguageContext';
import type { AssistantLang } from '../components/ai/assistantI18n';
import type { StructuredAction, StructuredSection } from '../components/ai/StructuredMessage';
import type { ToolStepView } from '../components/ai/ToolActivity';

export interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  headline?: string;
  sections?: StructuredSection[];
  actions?: StructuredAction[];
  sources?: Array<{ label: string; kind: 'live' | 'official' | 'model' | 'guidance' }>;
  toolActivity?: ToolStepView[];
  emergency?: boolean;
  emergencyReason?: string;
  hospitals?: Array<{ name: string; detail: string; phone?: string }>;
  providerLabel?: string;
  languageFallback?: boolean;
  error?: boolean;
}

export interface Area {
  city: string;
  district: string;
  state: string;
  label: string;
}

export type ConnState = 'connecting' | 'online' | 'degraded' | 'offline';

export type LocationPermissionState =
  | 'NOT_REQUESTED'
  | 'REQUESTING'
  | 'GRANTED'
  | 'DENIED'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'MANUAL';

export interface CapturedDeviceLocation {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  source: 'GPS';
  capturedAt: string;
  address?: string;
  locality?: string;
  district?: string;
  state?: string;
}

export interface ReportFlowState {
  active: boolean;
  initialText: string;
  key: number;
}

function geolocationMessage(error: GeolocationPositionError): {
  state: LocationPermissionState;
  message: string;
} {
  if (error.code === error.PERMISSION_DENIED) {
    return {
      state: 'DENIED',
      message: 'Location permission was denied. You can still enter the incident location manually.',
    };
  }
  if (error.code === error.TIMEOUT) {
    return {
      state: 'TIMEOUT',
      message: 'Location request timed out. Try again or enter the incident location manually.',
    };
  }
  return {
    state: 'UNAVAILABLE',
    message: 'Device location is unavailable. Enter the incident location manually.',
  };
}

const EMERGENCY_SCAN =
  /\b(trapped|stuck|cannot get out|can'?t breathe|breathing|chest pain|flooding (my|our|the)? ?(house|home)|water (rising|inside)|fire|burning|gas leak|smell gas|injur|bleeding|ambulance|unconscious|collapse|drown|swept away|fas[ae]? gaya|phas gaya|bachao|madad)\b/i;

const now = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

interface AssistantContextValue {
  lang: AssistantLang;
  setLang: (l: AssistantLang) => void;
  conn: ConnState;
  messages: ChatMsg[];
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  sending: boolean;
  freshId: string | null;
  area: Area | null;
  riskLevel: string | null;
  riskScore: number | null;
  riskUpdated: string | null;
  riskLoading: boolean;
  locating: boolean;
  helplines: Array<{ service: string; code: string }>;
  emergencyCtx: { reason: string; hospitals: ChatMsg['hospitals'] } | null;
  deviceLocation: CapturedDeviceLocation | null;
  locationPermission: LocationPermissionState;
  locationMessage: string | null;
  locationPromptDismissed: boolean;
  dismissLocationPrompt: () => void;
  requestDeviceLocation: () => Promise<CapturedDeviceLocation | null>;
  reportFlow: ReportFlowState | null;
  startReportFlow: (initialText?: string) => void;
  closeReportFlow: () => void;
  sendQuery: (raw: string) => Promise<void>;
  handleSetLocation: (text: string) => Promise<void>;
  handleDeviceLocation: () => void;
}

const AssistantContext = createContext<AssistantContextValue | undefined>(undefined);

export const AssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lang: appLang, setLang: setAppLang } = useLanguage();
  const lang = appLang as AssistantLang;
  const setLang = useCallback((l: AssistantLang) => setAppLang(l), [setAppLang]);

  const [conn, setConn] = useState<ConnState>('connecting');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);

  const [area, setArea] = useState<Area | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [riskLevel, setRiskLevel] = useState<string | null>(null);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [riskUpdated, setRiskUpdated] = useState<string | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [deviceLocation, setDeviceLocation] = useState<CapturedDeviceLocation | null>(null);
  const [locationPermission, setLocationPermission] =
    useState<LocationPermissionState>('NOT_REQUESTED');
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationPromptDismissed, setLocationPromptDismissed] = useState(false);
  const [reportFlow, setReportFlow] = useState<ReportFlowState | null>(null);

  const [helplines, setHelplines] = useState<Array<{ service: string; code: string }>>([]);
  const [emergencyCtx, setEmergencyCtx] = useState<{
    reason: string;
    hospitals: ChatMsg['hospitals'];
  } | null>(null);

  // -- backend status (honest, polled once) ------------------------------------
  const checkStatus = useCallback(async () => {
    try {
      const s: any = await apiFetch('/ai/status');
      setConn(s.degraded ? 'degraded' : 'online');
    } catch {
      setConn('offline');
    }
  }, []);
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // -- context: helplines -------------------------------------------------------
  useEffect(() => {
    apiFetch('/resources/helplines')
      .then((r: any) => setHelplines((r.helplines || []).slice(0, 6)))
      .catch(() => setHelplines([]));
  }, []);

  const refreshRisk = useCallback(async (label: string) => {
    setRiskLoading(true);
    try {
      const r: any = await apiFetch(`/risk/${encodeURIComponent(label)}`);
      setRiskLevel(r.analysis.overallRiskLevel);
      setRiskScore(r.analysis.riskScore);
      setRiskUpdated(now());
    } catch {
      setRiskLevel(null);
      setRiskScore(null);
    } finally {
      setRiskLoading(false);
    }
  }, []);

  useEffect(() => {
    if (area) refreshRisk(area.label);
  }, [area, refreshRisk]);

  const applyArea = useCallback(
    (city: string, district: string, state: string, c: { lat: number; lng: number } | null) => {
      const label = `${city}, ${state}`;
      setArea({ city, district, state, label });
      setCoords(c);
      setRiskLevel(null);
      setRiskScore(null);
    },
    []
  );

  const handleSetLocation = useCallback(
    async (text: string) => {
      try {
        const r: any = await apiFetch(`/geo/resolve?location=${encodeURIComponent(text)}`);
        applyArea(r.geo.city, r.geo.district, r.geo.state, null);
      } catch {
        // This is a user-entered area, not a captured coordinate. Never attach
        // the geocoder's centroid to an incident.
        applyArea(text, text, 'India', null);
      }
      setDeviceLocation(null);
      setLocationPermission('MANUAL');
      setLocationMessage(
        'Area set manually for risk context. This does not capture an incident coordinate.'
      );
    },
    [applyArea]
  );

  const requestDeviceLocation = useCallback(async (): Promise<CapturedDeviceLocation | null> => {
    if (!('geolocation' in navigator)) {
      setLocationPermission('UNAVAILABLE');
      setLocationMessage('Device location is not supported. Enter the incident location manually.');
      return null;
    }

    setLocating(true);
    setLocationPermission('REQUESTING');
    setLocationMessage('Requesting device location. Your browser will ask for permission.');

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          let captured: CapturedDeviceLocation = {
            latitude,
            longitude,
            accuracyM: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
            source: 'GPS',
            capturedAt: new Date().toISOString(),
          };

          const [nearestResult, reverseResult] = await Promise.allSettled([
            apiFetch<any>(`/geo/nearest?lat=${latitude}&lng=${longitude}`),
            apiFetch<any>(`/geo/reverse?lat=${latitude}&lng=${longitude}`),
          ]);

          if (nearestResult.status === 'fulfilled' && nearestResult.value?.geo) {
            const geo = nearestResult.value.geo;
            applyArea(geo.city, geo.district, geo.state, { lat: latitude, lng: longitude });
          } else {
            applyArea('Current area', 'Current district', 'India', {
              lat: latitude,
              lng: longitude,
            });
          }

          if (reverseResult.status === 'fulfilled' && reverseResult.value?.location) {
            const location = reverseResult.value.location;
            captured = {
              ...captured,
              address: location.displayName || undefined,
              locality: location.locality || undefined,
              district: location.district || undefined,
              state: location.state || undefined,
            };
          }

          setDeviceLocation(captured);
          setLocationPermission('GRANTED');
          setLocationMessage(
            captured.accuracyM != null
              ? `Location captured with about ±${captured.accuracyM} m accuracy. It is only attached when you confirm an incident report.`
              : 'Location captured. It is only attached when you confirm an incident report.'
          );
          setLocating(false);
          resolve(captured);
        },
        (error) => {
          const info = geolocationMessage(error);
          setDeviceLocation(null);
          setLocationPermission(info.state);
          setLocationMessage(info.message);
          setLocating(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }, [applyArea]);

  const handleDeviceLocation = useCallback(() => {
    void requestDeviceLocation();
  }, [requestDeviceLocation]);

  const dismissLocationPrompt = useCallback(() => {
    setLocationPromptDismissed(true);
  }, []);

  const startReportFlow = useCallback((initialText = '') => {
    setReportFlow({
      active: true,
      initialText: initialText.trim().slice(0, 2000),
      key: Date.now(),
    });
  }, []);

  const closeReportFlow = useCallback(() => setReportFlow(null), []);

  // -- chat --------------------------------------------------------------------
  const sendQuery = useCallback(
    async (raw: string) => {
      const query = raw.trim();
      if (!query || sending) return;
      if (query === '__action:report') {
        const lastUserText =
          [...messages].reverse().find((message) => message.role === 'user')?.text || '';
        startReportFlow(lastUserText);
        return;
      }
      const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: 'user', text: query, timestamp: now() };
      const history = [...messages, userMsg];
      setMessages(history);
      setInput('');
      setSending(true);
      setFreshId(null);

      if (EMERGENCY_SCAN.test(query)) {
        setEmergencyCtx({ reason: 'Possible emergency detected in your message', hospitals: [] });
      }

      try {
        const payload: any = {
          messages: history.map((m) => ({ role: m.role, content: m.text })),
          language: lang,
        };
        if (area) payload.location = area.label;
        if (coords) payload.coords = coords;
        const res: any = await apiFetch('/ai/chat', { method: 'POST', body: JSON.stringify(payload) });
        setConn('online');
        const msgId = `a-${Date.now()}`;
        const assistant: ChatMsg = {
          id: msgId,
          role: 'assistant',
          text: res.response || '',
          timestamp: now(),
          headline: res.headline || 'Safety guidance',
          sections: res.sections || [],
          actions: (res.actions || []).map((a: any) =>
            a.kind === 'suggest' ? { ...a, kind: 'suggest' as const } : a
          ),
          sources: res.sources || [],
          toolActivity: res.toolActivity || [],
          emergency: Boolean(res.emergency),
          providerLabel:
            res.provider === 'local'
              ? 'JeevanGrid safety engine'
              : `${res.provider} · JeevanGrid validation`,
          languageFallback: Boolean(res.languageFallback),
        };
        if (res.emergency) {
          const help = (res.sections || []).find((s: any) => s.key === 'help');
          setEmergencyCtx({
            reason: res.headline,
            hospitals: (help?.facilities || []).map((f: any) => ({
              name: f.name,
              detail: f.detail,
              phone: f.phone,
            })),
          });
        }
        setMessages((prev) => [...prev, assistant]);
        setFreshId(msgId);
        window.setTimeout(() => {
          setFreshId((cur) => (cur === msgId ? null : cur));
        }, 4000);
      } catch (err) {
        console.error('AI assistant error:', err);
        setConn((c) => (c === 'online' ? c : 'offline'));
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            text: 'The safety service is unreachable right now. If you are in danger, call 112 immediately. Otherwise, check your local risk map or try again shortly.',
            timestamp: now(),
            error: true,
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [sending, messages, lang, area, coords, startReportFlow]
  );

  const value = useMemo(
    () => ({
      lang,
      setLang,
      conn,
      messages,
      input,
      setInput,
      sending,
      freshId,
      area,
      riskLevel,
      riskScore,
      riskUpdated,
      riskLoading,
      locating,
      helplines,
      emergencyCtx,
      deviceLocation,
      locationPermission,
      locationMessage,
      locationPromptDismissed,
      dismissLocationPrompt,
      requestDeviceLocation,
      reportFlow,
      startReportFlow,
      closeReportFlow,
      sendQuery,
      handleSetLocation,
      handleDeviceLocation,
    }),
    [
      lang,
      setLang,
      conn,
      messages,
      input,
      sending,
      freshId,
      area,
      riskLevel,
      riskScore,
      riskUpdated,
      riskLoading,
      locating,
      helplines,
      emergencyCtx,
      deviceLocation,
      locationPermission,
      locationMessage,
      locationPromptDismissed,
      dismissLocationPrompt,
      requestDeviceLocation,
      reportFlow,
      startReportFlow,
      closeReportFlow,
      sendQuery,
      handleSetLocation,
      handleDeviceLocation,
    ]
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
};

export function useAssistant(): AssistantContextValue {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error('useAssistant must be used within AssistantProvider');
  return ctx;
}
