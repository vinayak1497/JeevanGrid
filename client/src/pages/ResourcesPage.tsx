import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/client';

export const ResourcesPage: React.FC<{ onOpenEmergencyModal: () => void }> = ({ onOpenEmergencyModal }) => {
  const [shelters, setShelters] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'shelters' | 'hospitals' | 'inventory'>('shelters');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [sRes, hRes, rRes] = await Promise.all([
          apiFetch('/resources/shelters'),
          apiFetch('/resources/hospitals'),
          apiFetch('/resources/inventory'),
        ]);
        setShelters(sRes.shelters || []);
        setHospitals(hRes.hospitals || []);
        setInventory(rRes.resources || []);
      } catch (err) {
        console.error('Failed to load resources:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <main className="w-full pt-20 pb-space-3xl min-h-screen bg-surface">
      <section className="bg-surface-container-low py-space-xl border-b border-outline-variant/30">
        <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop">
          <div className="flex items-center gap-2 mb-1">
            <Link to="/" className="text-xs text-on-surface-variant hover:text-on-surface">Home</Link>
            <span>/</span>
            <span className="text-xs text-primary font-bold">Civic Infrastructure</span>
          </div>
          <h1 className="font-headline-xl text-3xl font-bold text-on-surface tracking-tight">
            Disaster Shelters &amp; Health Assets
          </h1>
          <p className="font-body-sm text-sm text-on-surface-variant mt-1 max-w-2xl">
            Vetted civic installations, emergency medical capacities, and relief logistics maintained across municipal wards.
          </p>

          <div className="flex gap-space-sm mt-space-lg">
            <button
              onClick={() => setActiveTab('shelters')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'shelters'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container'
              }`}
            >
              Public Shelters ({shelters.length})
            </button>
            <button
              onClick={() => setActiveTab('hospitals')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'hospitals'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container'
              }`}
            >
              Emergency Hospitals ({hospitals.length})
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'inventory'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container'
              }`}
            >
              Relief Equipment ({inventory.length})
            </button>
          </div>
        </div>
      </section>

      <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop mt-space-xl">
        {loading ? (
          <div className="text-center py-16 text-xs text-on-surface-variant">Loading civic inventory...</div>
        ) : (
          <div>
            {/* Shelters */}
            {activeTab === 'shelters' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
                {shelters.map((s) => (
                  <div
                    key={s.id}
                    className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-secondary uppercase">
                          {s.district}, {s.state}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-semibold">
                          Capacity: {s.capacity}
                        </span>
                      </div>
                      <h3 className="font-headline-sm text-base font-bold text-on-surface">{s.name}</h3>
                      <p className="text-xs text-on-surface-variant mt-1">{s.address}</p>
                      <div className="mt-space-sm p-space-xs rounded-lg bg-surface-container-low text-[11px] text-on-surface-variant">
                        <strong>Amenities:</strong> {s.amenities}
                      </div>
                    </div>
                    <div className="mt-space-md pt-space-sm border-t border-outline-variant/20 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-on-surface-variant block">Welfare Contact</span>
                        <span className="font-semibold text-on-surface">{s.contactPerson}</span>
                      </div>
                      <a
                        href={`tel:${s.contactPhone}`}
                        className="px-3 py-1.5 rounded-lg bg-secondary text-on-secondary text-xs font-bold"
                      >
                        Call Shelter
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Hospitals */}
            {activeTab === 'hospitals' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
                {hospitals.map((h) => (
                  <div
                    key={h.id}
                    className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-primary uppercase">
                          {h.district}, {h.state}
                        </span>
                        <span className="text-[10px] font-bold text-surface-tint">
                          Oxygen: {h.oxygenStockDays} days
                        </span>
                      </div>
                      <h3 className="font-headline-sm text-base font-bold text-on-surface">{h.name}</h3>
                      <p className="text-xs text-on-surface-variant mt-1">{h.address}</p>
                      <div className="grid grid-cols-2 gap-2 mt-space-sm">
                        <div className="p-2 rounded-lg bg-surface-container-low text-center">
                          <span className="text-[10px] text-on-surface-variant block">Available Beds</span>
                          <span className="font-code-num text-sm font-bold text-primary">{h.availableBeds} / {h.totalBeds}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-surface-container-low text-center">
                          <span className="text-[10px] text-on-surface-variant block">Available ICU</span>
                          <span className="font-code-num text-sm font-bold text-secondary">{h.availableIcuBeds} / {h.icuBeds}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-space-md pt-space-sm border-t border-outline-variant/20 flex items-center justify-between text-xs">
                      <span className="font-code-num font-semibold text-on-surface">{h.contactPhone}</span>
                      <a
                        href={`tel:${h.contactPhone}`}
                        className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold"
                      >
                        Call Hospital
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Equipment Inventory */}
            {activeTab === 'inventory' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
                {inventory.map((r) => (
                  <div
                    key={r.id}
                    className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-[11px] font-bold text-secondary uppercase">{r.type}</span>
                      <h3 className="font-headline-sm text-base font-bold text-on-surface mt-1">{r.name}</h3>
                      <div className="flex items-center gap-4 mt-3 text-xs">
                        <div>
                          <span className="text-[10px] text-on-surface-variant block">Total Units</span>
                          <span className="font-bold text-on-surface">{r.quantity}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-on-surface-variant block">Ready for Dispatch</span>
                          <span className="font-bold text-primary">{r.availableQuantity}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-space-md pt-space-sm border-t border-outline-variant/20 flex items-center justify-between text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-[#e9f3ed] text-primary text-[10px] font-bold">{r.status}</span>
                      <a href={`tel:${r.contactPhone}`} className="text-primary font-bold hover:underline">
                        Dispatch Line →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
};
