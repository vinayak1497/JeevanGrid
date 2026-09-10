import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const HealthDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHealthData() {
      try {
        const res = await apiFetch('/dashboards/health');
        setData(res);
      } catch (err) {
        console.error('Failed to load health dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHealthData();
  }, []);

  if (loading) {
    return <div className="pt-28 pb-20 text-center text-xs text-on-surface-variant">Loading Public Health Intelligence Hub...</div>;
  }

  const summary = data?.summary || {};

  return (
    <main className="w-full pt-20 pb-space-3xl min-h-screen bg-surface">
      <section className="bg-surface-container-low py-space-lg border-b border-outline-variant/30">
        <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div>
            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">
              Department of Health &amp; Family Welfare
            </span>
            <h1 className="font-headline-xl text-2xl font-bold text-on-surface">
              Disaster Medical &amp; Hospital Surge Grid
            </h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Health Officer: <strong>{user?.name || 'Dr. Sunita Deshmukh, MD'}</strong> • Surveillance Level: Active
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop mt-space-lg flex flex-col gap-space-lg">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md">
          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase">Available General Beds</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-2xl font-bold text-primary">{summary.availableBeds}</span>
              <span className="text-xs text-on-surface-variant">/ {summary.totalBeds}</span>
            </div>
            <span className="text-[10px] text-secondary font-semibold mt-1">
              Occupancy: {summary.bedOccupancyRate}%
            </span>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase">Available ICU Units</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-2xl font-bold text-secondary">{summary.availableIcu}</span>
              <span className="text-xs text-on-surface-variant">/ {summary.totalIcu}</span>
            </div>
            <span className="text-[10px] text-secondary font-semibold mt-1">
              ICU Surge: {summary.icuOccupancyRate}%
            </span>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase">Average Oxygen Buffer</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-2xl font-bold text-surface-tint">{summary.avgOxygenStockDays}</span>
              <span className="text-xs text-on-surface-variant">Days</span>
            </div>
            <span className="text-[10px] text-surface-tint font-semibold mt-1">Supply Lines Secure</span>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase">Epidemic Surveillance</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-2xl font-bold text-primary">04</span>
              <span className="text-xs text-on-surface-variant">Active Vectors</span>
            </div>
            <span className="text-[10px] text-on-surface font-semibold mt-1">Prophylaxis Active</span>
          </div>
        </div>

        {/* Disease Risk Indicators */}
        <div className="bg-surface-container-lowest rounded-2xl p-space-xl border border-outline-variant/30 shadow-sm">
          <h2 className="font-headline-sm text-base font-bold text-on-surface mb-space-md flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">coronavirus</span>
            <span>Post-Disaster Epidemic &amp; Vector Early Warning</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
            {data?.diseaseRiskIndicators?.map((ind: any, i: number) => (
              <div key={i} className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs text-on-surface">{ind.condition}</h3>
                  <span className="text-[11px] text-on-surface-variant">{ind.district} • Status: {ind.status}</span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                  ind.level === 'Moderate' ? 'bg-[#fef3c7] text-[#92400e]' : 'bg-[#e9f3ed] text-primary'
                }`}>
                  {ind.level}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Hospital Inventory Table */}
        <div className="bg-surface-container-lowest rounded-2xl p-space-xl border border-outline-variant/30 shadow-sm">
          <h2 className="font-headline-sm text-base font-bold text-on-surface mb-space-md">
            Facility Bed &amp; Trauma Surge Capacities
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/30 text-on-surface-variant text-[11px] uppercase">
                  <th className="py-2.5 px-3">Hospital Name</th>
                  <th className="py-2.5 px-3">District</th>
                  <th className="py-2.5 px-3">Total Beds</th>
                  <th className="py-2.5 px-3">Available Beds</th>
                  <th className="py-2.5 px-3">Available ICU</th>
                  <th className="py-2.5 px-3">Oxygen Stock</th>
                  <th className="py-2.5 px-3">Dispatch Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {data?.hospitals?.map((h: any) => (
                  <tr key={h.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-3 px-3 font-bold text-on-surface">{h.name}</td>
                    <td className="py-3 px-3 text-on-surface-variant">{h.district}</td>
                    <td className="py-3 px-3 font-code-num">{h.totalBeds}</td>
                    <td className="py-3 px-3 font-code-num font-bold text-primary">{h.availableBeds}</td>
                    <td className="py-3 px-3 font-code-num font-bold text-secondary">{h.availableIcuBeds}</td>
                    <td className="py-3 px-3 font-code-num">{h.oxygenStockDays} days</td>
                    <td className="py-3 px-3">
                      <a href={`tel:${h.contactPhone}`} className="text-primary font-bold hover:underline font-code-num">
                        {h.contactPhone}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
};
