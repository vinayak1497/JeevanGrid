import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useSpeechRecognition } from '../components/ai/useSpeechRecognition';
import {
  enqueueSubmission,
  flushOfflineQueue,
  getQueueSummary,
} from '../utils/offlineQueue';

const SPEECH_LANG: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  as: 'as-IN',
};

const EMERGENCY_TYPE_MAP: Record<string, string> = {
  FLOODING: 'Flood',
  FIRE: 'Fire',
  EARTHQUAKE: 'Earthquake',
  MEDICAL: 'Medical',
  LANDSLIDE: 'Landslide',
  STRANDED: 'Trapped Person',
  ROAD_BLOCKED: 'Infrastructure Damage',
  BRIDGE_DAMAGED: 'Infrastructure Damage',
  TREE_FALLEN: 'Infrastructure Damage',
  INFRASTRUCTURE: 'Infrastructure Damage',
  RESOURCE_SHORTAGE: 'Other',
  OTHER: 'Other',
};

const URGENCY_MAP: Record<string, string> = {
  MODERATE: 'Moderate',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

const VULNERABLE_LABELS: Record<string, string> = {
  ELDERLY: 'Elderly',
  CHILDREN: 'Children',
  PREGNANT: 'Pregnant',
  DISABLED: 'Disabled / mobility support',
};

const ASSISTANCE_LABELS: Record<string, string> = {
  EVACUATION: 'Evacuation',
  RESCUE: 'Rescue',
  MEDICAL: 'Medical',
  FOOD_WATER: 'Food & water',
  SHELTER: 'Shelter',
  BOAT: 'Boat',
};

function newIdempotencyKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `jg-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please select an image file.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Image is larger than 10 MB. Choose a smaller photo.');
  const raw = await readFileAsDataUrl(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unsupported image format.'));
      img.src = raw;
    });
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return raw;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return raw;
  }
}

export const EmergencyReportPage: React.FC<{ onOpenEmergencyModal: () => void }> = ({ onOpenEmergencyModal }) => {
  const { user } = useAuth();
  const { lang } = useLanguage();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [emergencyType, setEmergencyType] = useState('Flood');
  const [urgency, setUrgency] = useState('High');
  const [peopleAffected, setPeopleAffected] = useState(1);
  const [description, setDescription] = useState('');
  const [vulnerablePersons, setVulnerablePersons] = useState<string[]>([]);
  const [requiredAssistance, setRequiredAssistance] = useState<string[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractionMeta, setExtractionMeta] = useState<any>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<any>(null);
  const [queuedReport, setQueuedReport] = useState<any>(null);
  const [syncingQueued, setSyncingQueued] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  const speechLang = SPEECH_LANG[lang] || 'en-IN';
  const voice = useSpeechRecognition({
    lang: speechLang,
    onTranscript: (text) => setVoiceTranscript(text),
  });

  const emergencyTypes = [
    'Flood',
    'Fire',
    'Earthquake',
    'Medical',
    'Landslide',
    'Trapped Person',
    'Infrastructure Damage',
    'Other',
  ];
  const urgencies = ['Moderate', 'High', 'Critical'];

  const voiceButtonLabel = useMemo(() => {
    if (voice.state === 'recording') return 'Stop and keep transcript';
    if (voice.state === 'denied') return 'Microphone permission denied';
    return 'Start voice report';
  }, [voice.state]);

  const handleGpsDetect = () => {
    setDetectingGps(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          setAccuracyM(Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null);
          setLocationName(
            `GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
          );
          setDetectingGps(false);
        },
        () => {
          setDetectingGps(false);
          setErrorMessage(
            'GPS could not be read. Enter the landmark manually; no location was invented for you.'
          );
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    } else {
      setDetectingGps(false);
      setErrorMessage('GPS is not available on this device. Enter the landmark manually.');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    setPhotoUrl(null);
    setPhotoPreview(null);
    setPhotoUploading(true);
    try {
      const dataUrl = await compressImage(file);
      setPhotoPreview(dataUrl);
      const uploaded = await apiFetch<{ url: string }>('/uploads/report-photo', {
        method: 'POST',
        body: JSON.stringify({ dataUrl, folder: 'jeevangrid/reports' }),
      });
      setPhotoUrl(uploaded.url);
    } catch (err: any) {
      setPhotoError(
        `${err.message || 'Photo upload failed.'} The report can still be submitted without a photo.`
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleExtract = async () => {
    if (voiceTranscript.trim().length < 5) {
      setExtractionError('Speak or type at least a short sentence first.');
      return;
    }
    setExtracting(true);
    setExtractionError(null);
    try {
      const result = await apiFetch<any>('/ai/extract-emergency', {
        method: 'POST',
        body: JSON.stringify({ transcript: voiceTranscript, language: lang }),
      });
      const x = result.extraction;
      setEmergencyType(EMERGENCY_TYPE_MAP[x.incidentType] || 'Other');
      setUrgency(URGENCY_MAP[x.urgency] || 'High');
      setPeopleAffected(Math.max(1, Number(x.peopleAffected) || 1));
      setDescription(x.description || voiceTranscript);
      setVulnerablePersons(Array.isArray(x.vulnerablePersons) ? x.vulnerablePersons : []);
      setRequiredAssistance(Array.isArray(x.requiredAssistance) ? x.requiredAssistance : []);
      if (x.locationText) {
        setLocationName(x.locationText);
        setLatitude(null);
        setLongitude(null);
      }
      setExtractionMeta(result);
    } catch (err: any) {
      setExtractionError(err.message || 'Could not extract details. Please fill the form manually.');
    } finally {
      setExtracting(false);
    }
  };

  const toggleValue = (value: string, list: string[], setter: (next: string[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const buildPayload = () => ({
    citizenName: name,
    phone,
    locationName,
    latitude,
    longitude,
    district: user?.district,
    state: user?.state,
    emergencyType,
    urgency,
    peopleAffected,
    description,
    originalDescription: description,
    aiSummary: extractionMeta?.extraction?.description || description,
    photoUrl,
    vulnerablePersons,
    requiredAssistance,
    language: lang,
    aiProvider: extractionMeta?.provider || undefined,
    idempotencyKey,
    reportSource: 'CITIZEN_FORM',
    accuracyM,
    locationSource: latitude != null && longitude != null ? 'GPS' : 'MANUAL_ADDRESS',
    locationCapturedAt: latitude != null && longitude != null ? new Date().toISOString() : null,
    locationConfirmed,
  });

  const resetForm = () => {
    setSubmittedReport(null);
    setQueuedReport(null);
    setDescription('');
    setVoiceTranscript('');
    setExtractionMeta(null);
    setLocationName('');
    setLatitude(null);
    setLongitude(null);
    setPeopleAffected(1);
    setVulnerablePersons([]);
    setRequiredAssistance([]);
    setPhotoPreview(null);
    setPhotoUrl(null);
    setPhotoError(null);
    setLocationConfirmed(false);
    setIdempotencyKey(newIdempotencyKey());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !locationName || !description) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }
    if (!locationConfirmed) {
      setErrorMessage('Confirm that this is the incident location before submitting.');
      return;
    }
    if (photoUploading) {
      setErrorMessage('Wait for the photo upload to finish, or remove the photo.');
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    const payload = buildPayload();

    try {
      const res = await apiFetch<any>('/emergency-reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSubmittedReport(res);
    } catch (err: any) {
      const status = Number(err?.status || 0);
      const retryable = !status || status >= 500 || status === 0;
      if (retryable) {
        try {
          const item = await enqueueSubmission('emergency-report', '/emergency-reports', payload);
          setQueuedReport(item);
          setErrorMessage(null);
        } catch (queueError: any) {
          setErrorMessage(
            `${err.message || 'Submission failed.'} It could not be saved on this device: ${
              queueError.message || 'offline storage unavailable.'
            }`
          );
        }
      } else {
        setErrorMessage(err.message || 'The report was rejected. Please check the fields.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncQueued = async () => {
    setSyncingQueued(true);
    setErrorMessage(null);
    try {
      await flushOfflineQueue({ includeFailed: true });
      const queue = await getQueueSummary();
      const item = queue.items.find((i) => i.id === queuedReport?.id);
      if (item?.status === 'SYNCED' && item.serverResponse) {
        setSubmittedReport(item.serverResponse);
        setQueuedReport(null);
      } else {
        setErrorMessage(item?.lastError || 'Still offline or the server is unreachable. The report remains queued.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not retry the queued report.');
    } finally {
      setSyncingQueued(false);
    }
  };

  return (
    <main className="jg-page min-h-[100dvh] bg-surface pb-space-3xl">
      <div className="max-w-3xl mx-auto px-margin-mobile lg:px-margin-desktop py-space-xl">
        <div className="mb-space-xl">
          <div className="flex items-center gap-2 mb-1">
            <Link to="/" className="inline-flex min-h-[44px] items-center text-xs text-on-surface-variant hover:text-on-surface">Home</Link>
            <span className="text-xs text-on-surface-variant">/</span>
            <span className="text-xs text-error font-bold">Rapid Citizen Triage</span>
          </div>
          <h1 className="font-headline-xl text-3xl font-bold text-on-surface tracking-tight">
            Report an Emergency Incident
          </h1>
          <p className="font-body-sm text-sm text-on-surface-variant mt-1">
            Send a location and situation report to the District Disaster Management Authority. Every
            report starts unverified; submission does not dispatch a team.
          </p>
        </div>

        <div className="p-space-md rounded-xl bg-error-container/60 border border-error/30 mb-space-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-xs text-on-error-container">
            <span className="material-symbols-outlined text-[24px] text-error">emergency</span>
            <span className="text-xs font-semibold">
              Is someone in immediate, life-threatening danger right now?
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenEmergencyModal}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-error text-on-error text-xs font-bold hover:bg-[#991b1b] transition-all whitespace-nowrap shadow-sm"
          >
            Call 112 Dispatch
          </button>
        </div>

        {submittedReport ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-container-lowest rounded-2xl p-space-xl shadow-lg border border-outline-variant/30 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-[#e9f3ed] text-primary flex items-center justify-center mx-auto mb-space-md">
              <span className="material-symbols-outlined text-[36px]">mark_email_read</span>
            </div>

            <span className="px-3 py-1 rounded-full bg-surface-container-high text-xs font-bold uppercase text-primary tracking-wider">
              {submittedReport.duplicate ? 'Already Received' : 'Report Received'}
            </span>

            <h2 className="mt-2 text-headline-md font-bold text-on-surface">
              Report reference
            </h2>
            <p className="mx-auto mt-1 max-w-md break-all rounded-xl bg-surface-container-low px-3 py-2 text-center font-code-num text-sm font-semibold text-primary">
              {submittedReport.reportId}
            </p>

            <p className="font-body-sm text-sm text-on-surface-variant max-w-md mx-auto mt-2">
              JeevanGrid has received your report for <strong>{submittedReport.report?.locationName}</strong>.
              It is <strong>{submittedReport.verificationStatus || 'UNVERIFIED'}</strong> until a human reviews
              corroborating information. This is not a verified incident and no team has been dispatched
              automatically.
            </p>

            <div className="mt-space-lg p-space-md rounded-xl bg-surface-container-low border border-outline-variant/20 text-left flex flex-col gap-2 max-w-md mx-auto text-xs">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Verification:</span>
                <span className="font-bold text-primary">{submittedReport.verificationStatus || 'UNVERIFIED'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Operational status:</span>
                <span className="font-bold text-primary">
                  {submittedReport.incidentId ? 'TRIAGE PENDING' : 'AWAITING OFFICER REVIEW'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Emergency type:</span>
                <span className="font-semibold text-on-surface">{submittedReport.report?.emergencyType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">People affected:</span>
                <span className="font-semibold text-on-surface">{submittedReport.report?.peopleAffected}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Urgency stated by you:</span>
                <span className="font-bold text-error">{submittedReport.report?.urgency}</span>
              </div>
            </div>

            {submittedReport.duplicateCandidates?.length > 0 && (
              <div className="mt-space-md p-space-sm rounded-lg bg-[#fff7ed] border border-[#fed7aa] text-[11px] text-[#7c2d12] text-left max-w-md mx-auto">
                <strong>Possible duplicate:</strong> similar reports were submitted nearby at about the
                same time. An officer will compare them; this does not invalidate your report.
              </div>
            )}

            <div className="mt-space-xl flex flex-col sm:flex-row items-center justify-center gap-space-sm">
              <Link
                to="/"
                className="w-full sm:w-auto px-space-lg py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-semibold text-xs transition-colors"
              >
                Return to Home
              </Link>
              <button
                onClick={resetForm}
                className="w-full sm:w-auto px-space-lg py-2.5 rounded-lg bg-primary text-on-primary font-semibold text-xs hover:bg-primary-container transition-colors"
              >
                Submit Another Report
              </button>
            </div>
          </motion.div>
        ) : queuedReport ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container-lowest rounded-2xl p-space-xl shadow-lg border border-[#f59e0b]/40"
          >
            <div className="flex items-start gap-space-md">
              <div className="w-12 h-12 rounded-full bg-[#fff7ed] text-[#b45309] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[26px]">cloud_off</span>
              </div>
              <div>
                <h2 className="font-headline-lg text-xl font-bold text-on-surface">
                  Saved on this device — not yet received
                </h2>
                <p className="text-sm text-on-surface-variant mt-1">
                  JeevanGrid could not reach the server. Your report is queued locally with an
                  idempotency key and will sync when the connection returns. Until the banner says
                  synced, the district has <strong>not</strong> received it.
                </p>
                <p className="text-xs text-on-surface-variant mt-2">
                  Queued at {new Date(queuedReport.createdAt).toLocaleString()}. Keep this browser open.
                </p>
              </div>
            </div>
            {errorMessage && (
              <div className="mt-space-md p-space-sm rounded-lg bg-error-container text-on-error-container text-xs font-semibold">
                {errorMessage}
              </div>
            )}
            <div className="mt-space-lg flex flex-col sm:flex-row gap-space-sm">
              <button
                type="button"
                onClick={handleSyncQueued}
                disabled={syncingQueued}
                className="px-space-lg py-2.5 rounded-lg bg-primary text-on-primary font-semibold text-xs hover:bg-primary-container disabled:opacity-50"
              >
                {syncingQueued ? 'Retrying…' : 'Retry now'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-space-lg py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-semibold text-xs"
              >
                Start a new report
              </button>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-surface-container-lowest rounded-2xl p-space-xl shadow-sm border border-outline-variant/30 flex flex-col gap-space-md">
            {errorMessage && (
              <div className="p-space-sm rounded-lg bg-error-container text-on-error-container text-xs font-semibold">
                {errorMessage}
              </div>
            )}

            {/* Voice / text extraction */}
            <section className="rounded-xl border border-secondary/25 bg-surface-container-low p-space-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[19px] text-secondary">graphic_eq</span>
                    Speak or type in your language
                  </h2>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    The transcript is never sent automatically. AI extraction only fills the form for
                    you to review.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => (voice.state === 'recording' ? voice.stop() : voice.start())}
                    disabled={!voice.supported || voice.state === 'denied'}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 ${
                      voice.state === 'recording'
                        ? 'bg-error text-on-error'
                        : 'bg-surface-container-lowest border border-outline-variant/40 text-on-surface'
                    } disabled:opacity-50`}
                  >
                    <span className="material-symbols-outlined text-[17px]">
                      {voice.state === 'recording' ? 'stop_circle' : 'mic'}
                    </span>
                    {voiceButtonLabel}
                  </button>
                  <button
                    type="button"
                    onClick={handleExtract}
                    disabled={extracting || voiceTranscript.trim().length < 5}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-bold disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[17px]">auto_awesome</span>
                    {extracting ? 'Extracting…' : 'Extract into form'}
                  </button>
                </div>
              </div>

              {!voice.supported && (
                <p className="text-[11px] text-[#7c2d12] mt-2">
                  Voice capture is not supported in this browser. Type or paste the citizen’s words below.
                </p>
              )}
              {voice.state === 'denied' && (
                <p className="text-[11px] text-[#7c2d12] mt-2">
                  Microphone permission was denied. You can still type or paste the transcript.
                </p>
              )}

              <label className="block text-[11px] font-bold text-on-surface mt-3 mb-1" htmlFor="voice-transcript">
                Transcript (editable)
              </label>
              <textarea
                id="voice-transcript"
                rows={3}
                value={voiceTranscript}
                onChange={(e) => setVoiceTranscript(e.target.value)}
                placeholder={
                  lang === 'en'
                    ? 'Example: Water is rising, four people are trapped on the first floor, one elderly woman cannot walk.'
                    : 'Speak naturally, or type what the citizen said.'
                }
                className="w-full p-3 rounded-lg bg-surface-container-lowest text-on-surface text-sm border border-outline-variant/30 outline-none focus:border-primary resize-y"
              />
              {extractionError && (
                <p className="text-[11px] text-error font-semibold mt-1">{extractionError}</p>
              )}
              {extractionMeta && (
                <div className="mt-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-2.5 text-[11px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-primary">
                      {extractionMeta.provider === 'local_heuristic'
                        ? 'Offline rule extraction'
                        : `AI provider: ${extractionMeta.provider}`}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container-high font-semibold">
                      Confidence: {extractionMeta.extraction?.confidence || 'LOW'}
                    </span>
                    <span className="text-on-surface-variant">Review every field before submitting.</span>
                  </div>
                  {extractionMeta.warnings?.length > 0 && (
                    <ul className="mt-1.5 list-disc pl-4 text-on-surface-variant space-y-0.5">
                      {extractionMeta.warnings.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">Your Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm border border-outline-variant/30 outline-none focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">Contact Phone *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98200 12345"
                  className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm border border-outline-variant/30 outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-on-surface">Incident Location / Landmark *</label>
                <button
                  type="button"
                  onClick={handleGpsDetect}
                  disabled={detectingGps}
                  className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-secondary hover:text-on-secondary-container"
                >
                  <span className="material-symbols-outlined text-[16px]">my_location</span>
                  <span>{detectingGps ? 'Reading GPS...' : 'Detect GPS'}</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Street address, building name, or milestone"
                className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm border border-outline-variant/30 outline-none focus:border-primary"
              />
              <p className="text-[10px] text-on-surface-variant">
                Coordinates are only used when you detect GPS. Typed landmarks are geocoded by the
                server; no coordinate is invented.
              </p>
              <label className="mt-2 flex items-start gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-low p-2.5">
                <input
                  type="checkbox"
                  checked={locationConfirmed}
                  onChange={(e) => setLocationConfirmed(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#0A3A28]"
                />
                <span className="text-[11px] font-semibold text-on-surface">
                  I confirm this location is the incident location and not continuous tracking.
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">Emergency Type *</label>
                <select
                  value={emergencyType}
                  onChange={(e) => setEmergencyType(e.target.value)}
                  className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm border border-outline-variant/30 outline-none focus:border-primary"
                >
                  {emergencyTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">Urgency Level *</label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                  className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm border border-outline-variant/30 outline-none focus:border-primary"
                >
                  {urgencies.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">People Affected</label>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={peopleAffected}
                  onChange={(e) => setPeopleAffected(parseInt(e.target.value) || 1)}
                  className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm border border-outline-variant/30 outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-on-surface">Incident Description *</label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the current ground situation (water depth, trapped people, access problems)."
                className="p-3 rounded-lg bg-surface-container-low text-on-surface text-sm border border-outline-variant/30 outline-none focus:border-primary resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-xs font-bold text-on-surface mb-1">Vulnerable people (optional)</legend>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(VULNERABLE_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={vulnerablePersons.includes(value)}
                      onClick={() => toggleValue(value, vulnerablePersons, setVulnerablePersons)}
                      className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold ${
                        vulnerablePersons.includes(value)
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface-container-low border-outline-variant/40 text-on-surface'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-xs font-bold text-on-surface mb-1">Assistance needed (optional)</legend>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(ASSISTANCE_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={requiredAssistance.includes(value)}
                      onClick={() => toggleValue(value, requiredAssistance, setRequiredAssistance)}
                      className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold ${
                        requiredAssistance.includes(value)
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface-container-low border-outline-variant/40 text-on-surface'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-on-surface">Photo of Incident (Optional)</label>
              <div className="flex items-center gap-space-md flex-wrap">
                <label className="cursor-pointer px-4 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs font-semibold text-on-surface border border-outline-variant/30 flex items-center gap-1.5 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
                  <span>{photoUploading ? 'Uploading securely…' : 'Select / Take Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={photoUploading}
                    className="hidden"
                  />
                </label>
                {photoPreview && (
                  <div className="flex items-center gap-2">
                    <img src={photoPreview} alt="Incident preview" className="w-12 h-12 object-cover rounded-lg border border-outline-variant/30" />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoPreview(null);
                        setPhotoUrl(null);
                        setPhotoError(null);
                      }}
                      className="inline-flex min-h-[44px] items-center text-xs font-semibold text-error hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-on-surface-variant">
                Photos are uploaded to Cloudinary storage. Do not include identity documents or faces
                unless necessary.
              </p>
              {photoError && (
                <p className="text-[11px] text-[#7c2d12] font-semibold">{photoError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || photoUploading}
              className="mt-space-md h-12 rounded-xl bg-error hover:bg-[#991b1b] text-on-error font-headline-sm font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
            >
              <span className="material-symbols-outlined text-[20px]">send</span>
              <span>
                {submitting
                  ? 'Sending to JeevanGrid…'
                  : 'Submit Emergency Report (not a 112 call)'}
              </span>
            </button>
            <p className="text-[10px] text-on-surface-variant text-center">
              Submitting creates an unverified report. Only an authorised officer can verify an
              incident; JeevanGrid never dispatches automatically.
            </p>
          </form>
        )}
      </div>
    </main>
  );
};
