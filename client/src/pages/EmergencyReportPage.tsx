import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const EmergencyReportPage: React.FC<{ onOpenEmergencyModal: () => void }> = ({ onOpenEmergencyModal }) => {
  const { user } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [locationName, setLocationName] = useState('Milan Subway, Santacruz West, Mumbai');
  const [latitude, setLatitude] = useState<number | null>(19.0833);
  const [longitude, setLongitude] = useState<number | null>(72.8415);
  const [emergencyType, setEmergencyType] = useState('Flood');
  const [urgency, setUrgency] = useState('High');
  const [peopleAffected, setPeopleAffected] = useState(4);
  const [description, setDescription] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleGpsDetect = () => {
    setDetectingGps(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          setLocationName(`GPS: ${pos.coords.latitude.toFixed(4)}°N, ${pos.coords.longitude.toFixed(4)}°E (Mumbai Belt)`);
          setDetectingGps(false);
        },
        () => {
          setLatitude(19.0760);
          setLongitude(72.8777);
          setLocationName('Bandra West, Mumbai Suburban (400050)');
          setDetectingGps(false);
        },
        { timeout: 5000 }
      );
    } else {
      setLatitude(19.0760);
      setLongitude(72.8777);
      setLocationName('Bandra West, Mumbai Suburban (400050)');
      setDetectingGps(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !locationName || !description) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await apiFetch('/emergency-reports', {
        method: 'POST',
        body: JSON.stringify({
          citizenName: name,
          phone,
          locationName,
          latitude,
          longitude,
          emergencyType,
          urgency,
          peopleAffected,
          description,
          photoUrl: photoPreview,
        }),
      });

      setSubmittedReport(res);
    } catch (err: any) {
      console.error('Submit report error:', err);
      setErrorMessage(err.message || 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="w-full pt-20 pb-space-3xl min-h-screen bg-surface">
      <div className="max-w-3xl mx-auto px-margin-mobile lg:px-margin-desktop py-space-xl">
        <div className="mb-space-xl">
          <div className="flex items-center gap-2 mb-1">
            <Link to="/" className="text-xs text-on-surface-variant hover:text-on-surface">Home</Link>
            <span className="text-xs text-on-surface-variant">/</span>
            <span className="text-xs text-error font-bold">Rapid Citizen Triage</span>
          </div>
          <h1 className="font-headline-xl text-3xl font-bold text-on-surface tracking-tight">
            Report an Emergency Incident
          </h1>
          <p className="font-body-sm text-sm text-on-surface-variant mt-1">
            Broadcast verified GPS coordinates and situation details directly to District Disaster Management Authorities (DDMA) and SDRF responders.
          </p>
        </div>

        {/* Life Threat Warning Ribbon */}
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
            className="px-3 py-1.5 rounded-lg bg-error text-on-error text-xs font-bold hover:bg-[#991b1b] transition-all whitespace-nowrap shadow-xs"
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
              <span className="material-symbols-outlined text-[36px]">verified</span>
            </div>

            <span className="px-3 py-1 rounded-full bg-surface-container-high text-xs font-bold uppercase text-primary tracking-wider">
              Emergency Incident Logged
            </span>

            <h2 className="font-headline-lg text-2xl font-bold text-on-surface mt-2">
              Report Tracking ID: <span className="text-primary font-code-num">{submittedReport.reportId}</span>
            </h2>

            <p className="font-body-sm text-sm text-on-surface-variant max-w-md mx-auto mt-2">
              Your distress signal has entered the District Disaster Operations System. NDRF &amp; Local Ward units in <strong>{submittedReport.report?.locationName}</strong> have been notified.
            </p>

            {/* Simulation Status Card */}
            <div className="mt-space-lg p-space-md rounded-xl bg-surface-container-low border border-outline-variant/20 text-left flex flex-col gap-2 max-w-md mx-auto text-xs">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Incident Status:</span>
                <span className="font-bold text-primary">NEW (Triage Pending)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Emergency Type:</span>
                <span className="font-semibold text-on-surface">{submittedReport.report?.emergencyType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">People Affected:</span>
                <span className="font-semibold text-on-surface">{submittedReport.report?.peopleAffected} Persons</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Urgency Category:</span>
                <span className="font-bold text-error">{submittedReport.report?.urgency}</span>
              </div>
            </div>

            <div className="mt-space-xl flex flex-col sm:flex-row items-center justify-center gap-space-sm">
              <Link
                to="/"
                className="w-full sm:w-auto px-space-lg py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-semibold text-xs transition-colors"
              >
                Return to Home
              </Link>
              <button
                onClick={() => {
                  setSubmittedReport(null);
                  setDescription('');
                }}
                className="w-full sm:w-auto px-space-lg py-2.5 rounded-lg bg-primary text-on-primary font-semibold text-xs hover:bg-primary-container transition-colors"
              >
                Submit Another Report
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

            {/* Reporter Name & Phone */}
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

            {/* Location & GPS */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-on-surface">Incident Location / Landmark *</label>
                <button
                  type="button"
                  onClick={handleGpsDetect}
                  disabled={detectingGps}
                  className="text-xs text-secondary hover:text-on-secondary-container font-semibold inline-flex items-center gap-1"
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
            </div>

            {/* Emergency Type & Urgency */}
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
                  max="5000"
                  value={peopleAffected}
                  onChange={(e) => setPeopleAffected(parseInt(e.target.value) || 1)}
                  className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm border border-outline-variant/30 outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-on-surface">Incident Description *</label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe current ground situation (e.g. Water rising past 3 feet, senior citizens stranded on balcony, need boat evacuation)."
                className="p-3 rounded-lg bg-surface-container-low text-on-surface text-sm border border-outline-variant/30 outline-none focus:border-primary resize-none"
              />
            </div>

            {/* Photo Attachment */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-on-surface">Photo of Incident (Optional)</label>
              <div className="flex items-center gap-space-md">
                <label className="cursor-pointer px-4 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs font-semibold text-on-surface border border-outline-variant/30 flex items-center gap-1.5 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
                  <span>Select / Take Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
                {photoPreview && (
                  <div className="flex items-center gap-2">
                    <img src={photoPreview} alt="Incident preview" className="w-12 h-12 object-cover rounded-lg border border-outline-variant/30" />
                    <button
                      type="button"
                      onClick={() => setPhotoPreview(null)}
                      className="text-xs text-error font-semibold hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="mt-space-md h-12 rounded-xl bg-error hover:bg-[#991b1b] text-on-error font-headline-sm font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
            >
              <span className="material-symbols-outlined text-[20px]">send</span>
              <span>{submitting ? 'Broadcasting to SDRF...' : 'Broadcast Emergency Report'}</span>
            </button>
          </form>
        )}
      </div>
    </main>
  );
};
