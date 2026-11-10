import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../api/client';
import { useAssistant } from '../../context/AssistantContext';
import { useAuth } from '../../context/AuthContext';
import { getStrings } from '../ai/assistantI18n';
import { LocationPickerMap } from './LocationPickerMap';

type Phase = 'DESCRIBE' | 'LOCATE' | 'REVIEW' | 'SUBMIT' | 'SUCCESS';

interface Extracted {
  incidentType: string;
  urgency: string;
  peopleAffected: number;
  vulnerablePersons: string[];
  requiredAssistance: string[];
  description: string;
  locationText: string | null;
  language: string;
  confidence: string;
}

interface Draft {
  originalDescription: string;
  category: string;
  urgency: string;
  summary: string;
  peopleAffected: number;
  vulnerablePersons: string[];
  requiredAssistance: string[];
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  locationSource: 'GPS' | 'MANUAL_MAP' | 'MANUAL_ADDRESS' | 'NONE';
  locationCapturedAt: string | null;
  locationConfirmed: boolean;
  locationLabel: string;
}

interface SuccessState {
  reportId: string;
  incidentReference: string;
  incidentStatus: string;
  verificationStatus: string;
  createdAt: string;
  created: boolean;
}

const EMPTY_DRAFT: Draft = {
  originalDescription: '',
  category: '',
  urgency: 'MODERATE',
  summary: '',
  peopleAffected: 1,
  vulnerablePersons: [],
  requiredAssistance: [],
  locationName: '',
  latitude: null,
  longitude: null,
  accuracyM: null,
  locationSource: 'NONE',
  locationCapturedAt: null,
  locationConfirmed: false,
  locationLabel: '',
};

export const EmergencyReportFlow: React.FC<{
  initialText?: string;
  onClose?: () => void;
}> = ({ initialText = '', onClose }) => {
  const assistant = useAssistant();
  const { lang, area, requestDeviceLocation, deviceLocation, locationMessage, closeReportFlow } = assistant;
  const { user } = useAuth();
  const t = getStrings(lang);
  const [phase, setPhase] = useState<Phase>('DESCRIBE');
  const [text, setText] = useState(initialText);
  const [loadingExtraction, setLoadingExtraction] = useState(false);
  const [extraction, setExtraction] = useState<Extracted | null>(null);
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([]);
  const [providerLabel, setProviderLabel] = useState('');
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [citizenName, setCitizenName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const idempotencyKeyRef = useRef(`assistant-report-${Date.now()}`);

  const runExtraction = useCallback(
    async (sourceText: string) => {
      const clean = sourceText.trim();
      if (clean.length < 5) return;
      setLoadingExtraction(true);
      try {
        const result: any = await apiFetch('/ai/extract-emergency', {
          method: 'POST',
          body: JSON.stringify({ transcript: clean, language: lang }),
        });
        const e = result?.extraction;
        setExtraction({
          incidentType: String(e?.incidentType || 'OTHER'),
          urgency: String(e?.urgency || 'MODERATE'),
          peopleAffected: Number(e?.peopleAffected || 1),
          vulnerablePersons: Array.isArray(e?.vulnerablePersons) ? e.vulnerablePersons.map(String) : [],
          requiredAssistance: Array.isArray(e?.requiredAssistance) ? e.requiredAssistance.map(String) : [],
          description: String(e?.description || clean),
          locationText: e?.locationText ? String(e.locationText) : null,
          language: String(e?.language || 'en'),
          confidence: String(e?.confidence || 'MEDIUM'),
        });
        setExtractionWarnings(Array.isArray(result?.warnings) ? result.warnings.map(String) : []);
        setProviderLabel(String(result?.provider || 'offline'));
        setDraft((prev) => ({
          ...prev,
          originalDescription: clean,
          category: String(e?.incidentType || 'OTHER'),
          urgency: String(e?.urgency || 'MODERATE'),
          summary: String(e?.description || clean),
          peopleAffected: Number(e?.peopleAffected || 1),
          vulnerablePersons: Array.isArray(e?.vulnerablePersons) ? e.vulnerablePersons.map(String) : [],
          requiredAssistance: Array.isArray(e?.requiredAssistance) ? e.requiredAssistance.map(String) : [],
        }));
        setPhase('LOCATE');
      } catch {
        // The assistant extraction endpoint is local-first and should normally\n        // return a validated result; fall back to the structured UI without faking AI.\n        setPhase('DESCRIBE');
      } finally {
        setLoadingExtraction(false);
      }
    },
    [lang]
  );

  useEffect(() => {
    if (initialText.trim().length >= 5) void runExtraction(initialText);
    // One-time initialization from the assistant action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useDevice = async () => {
    const captured = await requestDeviceLocation();
    if (captured) {
      setDraft((prev) => ({
        ...prev,
        latitude: captured.latitude,
        longitude: captured.longitude,
        accuracyM: captured.accuracyM,
        locationSource: 'GPS',
        locationCapturedAt: captured.capturedAt,
        locationName: captured.address || prev.locationName || captured.locality || 'Current area',
        locationLabel: captured.address || captured.locality || 'Current area',
      }));
    }
  };

  const handleMapPick = async (lat: number, lng: number) => {
    setDraft((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      locationSource: 'MANUAL_MAP',
      locationCapturedAt: new Date().toISOString(),
      locationName: prev.locationName || 'Selected incident location',
    }));
    try {
      const result = await apiFetch<any>(`/geo/reverse?lat=${lat}&lng=${lng}`);
      const location = result?.location;
      if (location) {
        setDraft((prev) => ({
          ...prev,
          locationName: location.displayName || location.locality || prev.locationName || 'Selected incident location',
        }));
      }
    } catch {
      // Coordinates are retained even when reverse geocoding is unavailable.
    }
  };

  const enterReview = () => setPhase('REVIEW');

  const submit = async () => {
    if (!draft.originalDescription.trim()) {
      setSubmitMessage('Add the citizen’s own description before submitting.');
      return;
    }
    if (!draft.locationName.trim()) {
      setSubmitMessage('Capture or enter the incident location before submitting.');
      return;
    }
    if (!draft.locationConfirmed) {
      setSubmitMessage('Confirm the incident location before submitting.');
      setPhase('REVIEW');
      return;
    }
    setSubmitting(true);
    setSubmitMessage(null);
    try {
      const result: any = await apiFetch('/emergency-reports', {
        method: 'POST',
        body: JSON.stringify({
          citizenName: citizenName.trim(),
          phone: phone.trim(),
          locationName: draft.locationName.trim(),
          latitude: draft.latitude,
          longitude: draft.longitude,
          district: area?.district || undefined,
          state: area?.state || undefined,
          emergencyType: draft.category,
          urgency: draft.urgency,
          peopleAffected: draft.peopleAffected,
          description: draft.originalDescription.trim(),
          originalDescription: draft.originalDescription.trim(),
          aiSummary: draft.summary.trim(),
          accuracyM: draft.accuracyM,
          locationSource: draft.locationSource,
          locationCapturedAt: draft.locationCapturedAt,
          locationConfirmed: true,
          reportSource: 'AI_ASSISTANT',
          category: draft.category,
          vulnerablePersons: draft.vulnerablePersons,
          requiredAssistance: draft.requiredAssistance,
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });
      setSuccess({
        reportId: String(result?.reportId || ''),
        incidentReference: String(result?.incidentReference || ''),
        incidentStatus: String(result?.incidentStatus || ''),
        verificationStatus: String(result?.verificationStatus || ''),
        createdAt: String(result?.createdAt || ''),
        created: Boolean(result?.created),
      });
      setPhase('SUCCESS');
      setSubmitMessage(result?.created ? 'Report submitted. The incident is pending human verification.' : 'Report accepted from the saved duplicate record.');
    } catch (error: any) {
      setSubmitMessage(error?.message || 'Report submission failed. Please keep the details ready and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    closeReportFlow();
    onClose?.();
  };

  const heading =
    phase === 'DESCRIBE'
      ? 'Report an emergency'
      : phase === 'LOCATE'
        ? 'Confirm the incident location'
        : phase === 'REVIEW'
          ? 'Review the draft before submitting'
          : phase === 'SUBMIT'
            ? 'Submit for review'
            : 'Report received';

  return (
    <section
      data-report-flow="true"
      className="w-full rounded-2xl border border-primary/30 bg-surface-container-lowest p-4 shadow-lg"
      aria-label={heading}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-on-surface">{heading}</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-on-surface-variant">
            The AI may structure this report; a human officer must confirm and verify before assignment.
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          className="min-h-[44px] rounded-xl border border-outline-variant/40 px-3 py-2 text-xs font-bold text-on-surface-variant"
        >
          Close
        </button>
      </div>

      {phase === 'DESCRIBE' && (
        <div className="mt-4 space-y-3">
          <label className="block text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
            What happened?
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={2000}
            className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={loadingExtraction || text.trim().length < 5}
            onClick={() => void runExtraction(text)}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold min-h-[44px] text-on-primary disabled:opacity-60"
          >
            {loadingExtraction ? 'Reading details…' : 'Structure with assistant AI'}
          </button>
          {loadingExtraction && (
            <div className="flex items-center gap-2 rounded-xl bg-surface-container-low p-3 text-xs text-on-surface-variant">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Extracting only. Nothing is submitted yet.
            </div>
          )}
          {extraction && (
            <button type="button" onClick={() => setPhase('LOCATE')} className="w-full rounded-xl border border-primary px-4 py-3 text-sm font-bold min-h-[44px] text-primary">
              I have reviewed the details — confirm location
            </button>
          )}
        </div>
      )}

      {phase === 'LOCATE' && (
        <div className="mt-4 space-y-3">
          <label className="block text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
            Reporter name
          </label>
          <input
            value={citizenName}
            onChange={(e) => setCitizenName(e.target.value)}
            placeholder="Citizen name for the report"
            className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
          />
          <label className="block text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
            Contact phone
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Mobile number"
            className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
          />
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3 text-[12px]">
            {deviceLocation ? (
              <>
                <p className="font-bold text-on-surface">
                  Device location captured · ±{deviceLocation.accuracyM ?? '?'} m accuracy
                </p>
                <p className="mt-1 text-on-surface-variant">{deviceLocation.address || deviceLocation.locality || 'Current area'}</p>
                <p className="mt-0.5 text-on-surface-variant">
                  Source: GPS · Captured at {deviceLocation.capturedAt}
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-on-surface">No captured device location.</p>
                <p className="mt-1 text-on-surface-variant">
                  {locationMessage || 'Location permission was not granted. Capture or enter the location.'}
                </p>
              </>
            )}
          </div>
          <button type="button" onClick={() => void useDevice()} className="w-full rounded-xl bg-secondary-container px-4 py-3 text-sm font-bold min-h-[44px] text-on-secondary-container">
            Capture device location
          </button>
          <LocationPickerMap
            center={[19.05, 72.87]}
            position={draft.latitude != null && draft.longitude != null ? { lat: draft.latitude, lng: draft.longitude } : null}
            onPick={(lat, lng) => void handleMapPick(lat, lng)}
            height={260}
          />
          <label className="block text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
            Incident location
          </label>
          <input
            value={draft.locationName}
            onChange={(e) => setDraft((p) => ({ ...p, locationName: e.target.value }))}
            placeholder="Enter a landmark, road, village or address"
            className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="number"
              step="any"
              value={draft.latitude ?? ''}
              onChange={(e) => setDraft((p) => ({ ...p, latitude: e.target.value === '' ? null : Number(e.target.value) }))}
              placeholder="Latitude"
              className="rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
            />
            <input
              type="number"
              step="any"
              value={draft.longitude ?? ''}
              onChange={(e) => setDraft((p) => ({ ...p, longitude: e.target.value === '' ? null : Number(e.target.value) }))}
              placeholder="Longitude"
              className="rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
            />
          </div>
          <button type="button" onClick={() => setPhase('REVIEW')} className="w-full rounded-xl border border-primary px-4 py-3 text-sm font-bold min-h-[44px] text-primary">
            Continue to review
          </button>
        </div>
      )}

      {phase === 'REVIEW' && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-2 text-[12px]">
            <label className="block">
              <span className="font-bold text-on-surface-variant">Citizen description</span>
              <textarea
                value={draft.originalDescription}
                onChange={(e) => setDraft((p) => ({ ...p, originalDescription: e.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="font-bold text-on-surface-variant">Incident type</span>
                <select
                  value={draft.category}
                  onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface"
                >
                  {['FLOODING','FIRE','EARTHQUAKE','LANDSLIDE','MEDICAL','STRANDED','ROAD_BLOCKED','BRIDGE_DAMAGED','TREE_FALLEN','INFRASTRUCTURE','RESOURCE_SHORTAGE','OTHER'].map((c) => (
                    <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="font-bold text-on-surface-variant">Urgency</span>
                <select
                  value={draft.urgency}
                  onChange={(e) => setDraft((p) => ({ ...p, urgency: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface"
                >
                  {['MODERATE','HIGH','CRITICAL'].map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="font-bold text-on-surface-variant">AI advisory summary</span>
              <input
                value={draft.summary}
                onChange={(e) => setDraft((p) => ({ ...p, summary: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="font-bold text-on-surface-variant">People affected</span>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={draft.peopleAffected}
                  onChange={(e) => setDraft((p) => ({ ...p, peopleAffected: Number(e.target.value) || 1 }))}
                  className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface"
                />
              </label>
              <label className="block">
                <span className="font-bold text-on-surface-variant">Accuracy (m)</span>
                <input
                  type="number"
                  min={0}
                  value={draft.accuracyM ?? ''}
                  onChange={(e) => setDraft((p) => ({ ...p, accuracyM: e.target.value === '' ? null : Number(e.target.value) }))}
                  className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface"
                />
              </label>
            </div>
            <label className="flex items-start gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low p-3 text-[12px]">
              <input
                type="checkbox"
                checked={draft.locationConfirmed}
                onChange={(e) => setDraft((p) => ({ ...p, locationConfirmed: e.target.checked }))}
                className="mt-1"
              />
              <span>
                <span className="font-bold text-on-surface">I confirm this is the incident location.</span>{' '}
                <span className="text-on-surface-variant">
                  The device location is only attached here, after this confirmation.
                </span>
              </span>
            </label>
          </div>
          <button type="button" onClick={() => setPhase('LOCATE')} className="w-full rounded-xl border border-outline-variant/40 px-4 py-3 text-sm font-bold min-h-[44px] text-on-surface-variant">
            Back to location
          </button>
          <button type="button" onClick={() => setPhase('SUBMIT')} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold min-h-[44px] text-on-primary">
            Submit draft
          </button>
        </div>
      )}

      {phase === 'SUBMIT' && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-surface-container-low p-3 text-[12px] text-on-surface-variant">
            Submission stores a citizen report and an operational incident. It does not verify, assign, dispatch, or close.
          </div>
          <button type="button" onClick={() => void submit()} disabled={submitting} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold min-h-[44px] text-on-primary disabled:opacity-60">
            {submitting ? 'Submitting…' : 'Confirm and submit incident'}
          </button>
          {submitMessage && <p className="text-[12px] font-semibold text-on-surface-variant">{submitMessage}</p>}
        </div>
      )}

      {phase === 'SUCCESS' && success && (
        <div className="mt-4 space-y-2 rounded-xl border border-secondary/40 bg-secondary-container/20 p-3">
          <p className="text-[13px] font-bold text-on-surface">Your report reference is ready.</p>
          <p className="text-[12px] text-on-surface-variant">
            {success.incidentReference ? `Reference: ${success.incidentReference}` : 'Reference pending.'} · Status: {success.incidentStatus || 'NEW'} · Verification: {success.verificationStatus || 'UNVERIFIED'}
          </p>
          <p className="text-[11px] text-on-surface-variant">
            Submitted at {success.createdAt}. This record is not verified and no dispatch has been made. Keep your phone reachable.
          </p>
          <button type="button" onClick={close} className="w-full rounded-xl border border-outline-variant/40 px-4 py-3 text-sm font-bold min-h-[44px] text-on-surface">
            Return to assistant
          </button>
        </div>
      )}

      {phase === 'LOCATE' && (
        <button type="button" onClick={() => setPhase('DESCRIBE')} className="w-full rounded-xl border border-outline-variant/40 px-4 py-3 text-sm font-bold min-h-[44px] text-on-surface-variant">
          Back to details
        </button>
      )}

      {phase !== 'SUCCESS' && (
        <div className="mt-4 rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{t.toolWorking}</p>
          <p className="mt-1 text-[11px] text-on-surface-variant">
            You have not submitted anything yet. Submission happens only after the review step.
          </p>
        </div>
      )}
    </section>
  );
};
