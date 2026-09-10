import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../api/client';

export const GuideDetailPage: React.FC<{ onOpenEmergencyModal: () => void }> = ({ onOpenEmergencyModal }) => {
  const { slug } = useParams<{ slug: string }>();
  const [guide, setGuide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'phases' | 'dos' | 'kit'>('phases');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchGuide() {
      setLoading(true);
      try {
        const res = await apiFetch(`/guides/${slug}`);
        setGuide(res.guide);
      } catch (err) {
        console.error('Failed to load guide details:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchGuide();
  }, [slug]);

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="pt-32 pb-20 flex justify-center text-xs text-on-surface-variant min-h-screen">
        Loading safety manual...
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="pt-32 pb-20 text-center min-h-screen">
        <h2 className="text-base font-bold mb-2">Guide not found</h2>
        <Link to="/guides" className="text-xs text-primary font-bold hover:underline">
          Return to All Guides
        </Link>
      </div>
    );
  }

  return (
    <main className="w-full pt-20 pb-space-3xl min-h-screen bg-surface">
      {/* Top Banner with Image */}
      <section className="relative w-full h-72 overflow-hidden bg-primary-container">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-luminosity"
          style={{ backgroundImage: `url('${guide.imageUrl}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-transparent" />
        <div className="relative z-10 max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop h-full flex flex-col justify-end pb-space-lg">
          <div className="flex items-center gap-2 mb-2 text-xs text-on-surface-variant">
            <Link to="/guides" className="hover:text-on-surface">Guides</Link>
            <span>/</span>
            <span className="text-primary font-bold">{guide.hazardType}</span>
          </div>
          <span className="text-xs uppercase font-bold text-secondary tracking-wider">
            {guide.category} Safety Protocol
          </span>
          <h1 className="font-headline-xl text-3xl font-bold text-on-surface mt-1">
            {guide.title}
          </h1>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop mt-space-lg">
        {/* Navigation Tabs */}
        <div className="flex border-b border-outline-variant/30 gap-space-md mb-space-xl">
          <button
            onClick={() => setActiveTab('phases')}
            className={`pb-space-sm font-label-md text-xs font-bold transition-all border-b-2 ${
              activeTab === 'phases'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Chronological Phases (Before / During / After)
          </button>
          <button
            onClick={() => setActiveTab('dos')}
            className={`pb-space-sm font-label-md text-xs font-bold transition-all border-b-2 ${
              activeTab === 'dos'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Do's and Don'ts Checklist
          </button>
          <button
            onClick={() => setActiveTab('kit')}
            className={`pb-space-sm font-label-md text-xs font-bold transition-all border-b-2 ${
              activeTab === 'kit'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Emergency Kit Supplies
          </button>
        </div>

        {/* Tab 1: Chronological Phases */}
        {activeTab === 'phases' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg">
            {/* Before */}
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-space-sm">
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary text-[11px] font-bold uppercase">
                    Phase 1 • BEFORE
                  </span>
                  <span className="text-[11px] text-on-surface-variant">Readiness</span>
                </div>
                <h3 className="font-headline-sm text-base font-bold text-on-surface mb-space-md">
                  Pre-Event Mitigation
                </h3>
                <ul className="flex flex-col gap-space-sm">
                  {guide.beforeSteps?.map((step: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-on-surface leading-relaxed">
                      <span className="material-symbols-outlined text-surface-tint text-[16px] shrink-0 mt-0.5">check_circle</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* During */}
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-space-sm">
                  <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-bold uppercase">
                    Phase 2 • DURING
                  </span>
                  <span className="text-[11px] text-on-surface-variant">Active Danger</span>
                </div>
                <h3 className="font-headline-sm text-base font-bold text-on-surface mb-space-md">
                  Immediate Survival Actions
                </h3>
                <ul className="flex flex-col gap-space-sm">
                  {guide.duringSteps?.map((step: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-on-surface leading-relaxed">
                      <span className="material-symbols-outlined text-secondary text-[16px] shrink-0 mt-0.5">priority_high</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* After */}
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-space-sm">
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface text-[11px] font-bold uppercase">
                    Phase 3 • AFTER
                  </span>
                  <span className="text-[11px] text-on-surface-variant">Recovery</span>
                </div>
                <h3 className="font-headline-sm text-base font-bold text-on-surface mb-space-md">
                  Post-Crisis Safety &amp; Hygiene
                </h3>
                <ul className="flex flex-col gap-space-sm">
                  {guide.afterSteps?.map((step: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-on-surface leading-relaxed">
                      <span className="material-symbols-outlined text-outline text-[16px] shrink-0 mt-0.5">health_and_safety</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Do's and Don'ts */}
        {activeTab === 'dos' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
            <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/30">
              <h3 className="font-headline-sm text-base font-bold text-primary flex items-center gap-2 mb-space-md">
                <span className="material-symbols-outlined text-[20px]">task_alt</span>
                <span>RECOMMENDED ACTIONS (DO'S)</span>
              </h3>
              <ul className="flex flex-col gap-space-sm">
                {guide.dos?.map((item: string, idx: number) => (
                  <li key={idx} className="p-space-sm rounded-lg bg-surface-container-low text-xs text-on-surface flex items-start gap-2">
                    <span className="material-symbols-outlined text-surface-tint text-[18px] shrink-0 mt-0.5">check</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/30">
              <h3 className="font-headline-sm text-base font-bold text-error flex items-center gap-2 mb-space-md">
                <span className="material-symbols-outlined text-[20px]">block</span>
                <span>DANGEROUS MISTAKES (DON'TS)</span>
              </h3>
              <ul className="flex flex-col gap-space-sm">
                {guide.donts?.map((item: string, idx: number) => (
                  <li key={idx} className="p-space-sm rounded-lg bg-error-container/40 text-xs text-on-surface flex items-start gap-2">
                    <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">close</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Tab 3: Emergency Kit Checklist */}
        {activeTab === 'kit' && (
          <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/30 max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-space-md">
              <div>
                <h3 className="font-headline-sm text-lg font-bold text-on-surface">Recommended Kit Supplies</h3>
                <p className="text-xs text-on-surface-variant">Check items off as you pack your household grab bag.</p>
              </div>
              <span className="text-xs font-bold text-primary">
                {Object.values(checkedItems).filter(Boolean).length} / {guide.kitItems?.length || 0} Packed
              </span>
            </div>

            <div className="flex flex-col gap-space-sm">
              {guide.kitItems?.map((item: string, idx: number) => {
                const key = `kit-${idx}`;
                const isChecked = Boolean(checkedItems[key]);
                return (
                  <label
                    key={key}
                    onClick={() => toggleCheck(key)}
                    className={`p-space-md rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-[#e9f3ed] border-[#c7e2d3] text-primary line-through'
                        : 'bg-surface-container-low border-outline-variant/30 text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-primary"
                    />
                    <span className="text-xs font-medium">{item}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Evacuation Triggers & Quick Help Bar */}
        <div className="mt-space-2xl p-space-xl rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md">
          <div className="max-w-xl">
            <span className="text-[11px] font-bold text-error uppercase tracking-wide flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-error"></span> Official Evacuation Triggers
            </span>
            <p className="text-xs text-on-surface mt-1 leading-relaxed">
              {guide.evacuationTriggers?.[0] || 'Official evacuation broadcast by District Collector or Police loud-hailers.'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/assistant"
              className="px-4 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary text-xs font-bold transition-colors"
            >
              Ask AI About This
            </Link>
            <button
              onClick={onOpenEmergencyModal}
              className="px-4 py-2 rounded-lg bg-error text-on-error text-xs font-bold hover:bg-[#991b1b] transition-colors"
            >
              Emergency Helpline
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};
