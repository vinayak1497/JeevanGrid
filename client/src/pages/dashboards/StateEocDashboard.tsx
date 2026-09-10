import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const StateEocDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStateData() {
      try {
        const res = await apiFetch('/dashboards/state');
        setData(res);
      } catch (err) {
        console.error('Failed to load State EOC data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStateData();
  }, []);

  if (loading) {
    return <div className="pt-28 pb-20 text-center text-xs text-on-surface-variant">Loading State Operations Grid...</div>;
  }

  return (
    <main className="w-full pt-20 pb-space-3xl min-h-screen bg-surface">
      <section className="bg-surface-container-low py-space-lg border-b border-outline-variant/30">
        <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div>
            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">
              State Emergency Operations Centre (SEOC)
            </span>
            <h1 className="font-headline-xl text-2xl font-bold text-on-surface">
              {data?.state || 'Maharashtra'} Multi-District Command
            </h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
              SEOC Director: <strong>{user?.name || 'Smt. Ananya Sen'}</strong> • State Resilience Level 3 Active
              {data?.lastSuccessfulSync
                ? ` • Official warnings synced ${new Date(data.lastSuccessfulSync).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}`
                : ''}
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop mt-space-lg flex flex-col gap-space-lg">
        {/* State Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md">
          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase">Active Official Warnings</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-2xl font-bold text-error">{data?.activeAlertsCount ?? '—'}</span>
              <span className="text-xs text-on-surface-variant">Verified live</span>
            </div>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase">Total Open Incidents</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-2xl font-bold text-primary">{data?.totalStateIncidents ?? '—'}</span>
              <span className="text-xs text-on-surface-variant">Across state</span>
            </div>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase">NDRF Battalions Staged</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-2xl font-bold text-secondary">06</span>
              <span className="text-xs text-on-surface-variant">Active teams</span>
            </div>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase">Overall State Readiness</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-2xl font-bold text-surface-tint">96.4%</span>
              <span className="text-xs text-on-surface-variant">Operational</span>
            </div>
          </div>
        </div>

        {/* District Risk & Vulnerability Comparison Table */}
        <div className="bg-surface-container-lowest rounded-2xl p-space-xl border border-outline-variant/30 shadow-sm">
          <h2 className="font-headline-sm text-base font-bold text-on-surface mb-space-md">
            Administrative District Vulnerability Comparison
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/30 text-on-surface-variant text-[11px] uppercase">
                  <th className="py-2.5 px-3">District</th>
                  <th className="py-2.5 px-3">Risk Tier</th>
                  <th className="py-2.5 px-3">Active Incidents</th>
                  <th className="py-2.5 px-3">24h Rainfall (mm)</th>
                  <th className="py-2.5 px-3">Shelter Occupancy</th>
                  <th className="py-2.5 px-3">DDMA Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {data?.districtComparison?.map((d: any, idx: number) => (
                  <tr key={idx} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-3 px-3 font-bold text-on-surface">{d.district}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        d.riskLevel === 'WARNING' ? 'bg-error-container text-on-error-container' : d.riskLevel === 'MODERATE' ? 'bg-[#fef3c7] text-[#92400e]' : 'bg-[#e9f3ed] text-primary'
                      }`}>
                        {d.riskLevel}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-code-num font-semibold">{d.activeIncidents}</td>
                    <td className="py-3 px-3 font-code-num">{d.rainfallMm ?? '—'}{d.rainfallMm != null ? ' mm' : ''}</td>
                    <td className="py-3 px-3 font-code-num">{d.shelterOccupancy}%</td>
                    <td className="py-3 px-3 font-medium text-on-surface-variant">{d.status}</td>
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
