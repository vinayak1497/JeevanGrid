import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/client';

export const GuidesPage: React.FC = () => {
  const [guides, setGuides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGuides() {
      try {
        const res = await apiFetch('/guides');
        setGuides(res.guides || []);
      } catch (err) {
        console.error('Failed to load guides:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchGuides();
  }, []);

  return (
    <main className="w-full pt-20 pb-space-3xl min-h-screen bg-surface">
      {/* Header Banner */}
      <section className="bg-surface-container-low py-space-xl border-b border-outline-variant/30">
        <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop">
          <div className="flex items-center gap-2 mb-1">
            <Link to="/" className="text-xs text-on-surface-variant hover:text-on-surface">Home</Link>
            <span className="text-xs text-on-surface-variant">/</span>
            <span className="text-xs text-primary font-bold">Resilience Knowledge</span>
          </div>
          <h1 className="font-headline-xl text-3xl font-bold text-on-surface tracking-tight">
            Disaster Preparedness &amp; Safety Protocols
          </h1>
          <p className="font-body-sm text-sm text-on-surface-variant mt-1 max-w-2xl">
            Standardized operational procedures issued by the National Disaster Management Authority (NDMA) for major natural perils across the Indian subcontinent.
          </p>
        </div>
      </section>

      {/* Directory Grid */}
      <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop mt-space-xl">
        {loading ? (
          <div className="flex justify-center py-12 text-xs text-on-surface-variant">
            Loading safety playbooks...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-lg">
            {guides.map((guide) => (
              <Link
                key={guide.slug}
                to={`/guides/${guide.slug}`}
                className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col border border-outline-variant/30 group"
              >
                <div
                  className="h-40 w-full bg-surface-container-high bg-cover bg-center"
                  style={{ backgroundImage: `url('${guide.imageUrl}')` }}
                />
                <div className="p-space-lg flex flex-col justify-between flex-1">
                  <div>
                    <span className="text-[11px] font-bold text-secondary uppercase">
                      {guide.category}
                    </span>
                    <h3 className="font-headline-sm text-base font-bold text-on-surface group-hover:text-primary transition-colors mt-1">
                      {guide.title}
                    </h3>
                    <p className="font-body-sm text-xs text-on-surface-variant mt-2 leading-relaxed">
                      {guide.summary}
                    </p>
                  </div>

                  <div className="mt-space-lg pt-space-sm border-t border-outline-variant/20 flex items-center justify-between text-xs text-primary font-semibold">
                    <span>{guide.guidelineCount} Protocols</span>
                    <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      <span>Read Manual</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};
