import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api/client';
import { LeafletMap, type MapPolygon } from '../LeafletMap';
import {
  DataCaveat,
  EmptyState,
  Metric,
  SectionCard,
  StatusBadge,
  formatDateTime,
  primaryButton,
  secondaryButton,
} from './IntelligenceUI';

function geometryToPolygons(geometry: any, color: string, label: string): MapPolygon[] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') {
    return [
      {
        id: `${label}-0`,
        positions: (geometry.coordinates?.[0] || []).map(([lng, lat]: number[]) => [lat, lng] as [number, number]),
        color,
        label,
        dashArray: '8 5',
      },
    ];
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates || []).map((polygon: number[][][], index: number) => ({
      id: `${label}-${index}`,
      positions: (polygon?.[0] || []).map(([lng, lat]: number[]) => [lat, lng] as [number, number]),
      color,
      label: `${label} #${index + 1}`,
      dashArray: '8 5',
    }));
  }
  return [];
}

export const SatellitePanel: React.FC<{
  district?: string;
  initialLayers?: any[];
  onChanged?: () => void;
}> = ({ district, initialLayers = [], onChanged }) => {
  const [layers, setLayers] = useState<any[]>(initialLayers);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string>(initialLayers[0]?.id || '');
  const [showAll, setShowAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [geojson, setGeojson] = useState<any>(null);
  const [fileName, setFileName] = useState('');
  const [featureCount, setFeatureCount] = useState<number | null>(null);
  const [form, setForm] = useState({
    eventName: '',
    areaName: '',
    district: district || '',
    sourceOrganisation: '',
    observationDate: '',
    processedDate: '',
    productReference: '',
    geometryPrecision: 'APPROXIMATE',
    verificationStatus: 'UNVERIFIED',
    isSimulation: false,
  });
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [catalogue, setCatalogue] = useState<any>(null);
  const [catalogueBusy, setCatalogueBusy] = useState(false);
  const [bbox, setBbox] = useState({ west: '', south: '', east: '', north: '', from: '', to: '', collection: 'sentinel-1-grd' });

  const districtQuery = district ? `?district=${encodeURIComponent(district)}` : '';

  const load = async () => {
    setError(null);
    try {
      const [layerResponse, statusResponse] = await Promise.all([
        apiFetch<{ layers: any[] }>(`/satellite/layers${districtQuery}`),
        apiFetch<any>('/satellite/status'),
      ]);
      setLayers(layerResponse.layers || []);
      setStatus(statusResponse);
    } catch (err: any) {
      setError(err.message || 'Satellite layers are unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district]);

  useEffect(() => {
    if (!selectedLayerId && layers[0]?.id) setSelectedLayerId(layers[0].id);
  }, [layers, selectedLayerId]);

  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId);
  const displayLayers = showAll ? layers : selectedLayer ? [selectedLayer] : [];

  const mapPolygons = displayLayers.flatMap((layer) =>
    geometryToPolygons(
      layer.geojson,
      layer.isSimulation ? '#b45309' : layer.verificationStatus === 'VERIFIED' ? '#1d4ed8' : '#64748b',
      `${layer.isSimulation ? 'SIMULATION · ' : ''}${layer.eventName}`
    )
  );

  const fileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setGeojson(null);
    setFileName('');
    setFeatureCount(null);
    if (file.size > 10 * 1024 * 1024) {
      setError('GeoJSON is larger than 10 MB. Simplify the product before importing.');
      return;
    }
    try {
      const parsed = JSON.parse(await file.text());
      let count = 1;
      if (parsed?.type === 'FeatureCollection') count = parsed.features?.length || 0;
      if (!count) throw new Error('FeatureCollection has no features.');
      setGeojson(parsed);
      setFileName(file.name);
      setFeatureCount(count);
    } catch (err: any) {
      setError(`Could not parse GeoJSON: ${err.message}`);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geojson) {
      setError('Select a GeoJSON product file first.');
      return;
    }
    if (!form.eventName || !form.areaName || !form.district || !form.sourceOrganisation || !form.productReference) {
      setError('Complete the event, area, district, source and product reference fields.');
      return;
    }
    if (!form.observationDate || !form.processedDate) {
      setError('Observation and processing dates are required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch<any>('/satellite/layers', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          geojson,
        }),
      });
      setNotice(response.message);
      setGeojson(null);
      setFileName('');
      setFeatureCount(null);
      setForm({
        eventName: '',
        areaName: '',
        district: district || '',
        sourceOrganisation: '',
        observationDate: '',
        processedDate: '',
        productReference: '',
        geometryPrecision: 'APPROXIMATE',
        verificationStatus: 'UNVERIFIED',
        isSimulation: false,
      });
      await load();
      onChanged?.();
    } catch (err: any) {
      setError(err.message || 'Satellite layer import failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const searchCatalogue = async () => {
    const payload = {
      bbox: [bbox.west, bbox.south, bbox.east, bbox.north].map(Number),
      from: bbox.from,
      to: bbox.to,
      collection: bbox.collection,
    };
    if (payload.bbox.some((n) => !Number.isFinite(n)) || !bbox.from || !bbox.to) {
      setError('Catalogue search needs a valid bbox, from and to date.');
      return;
    }
    setCatalogueBusy(true);
    setError(null);
    try {
      setCatalogue(await apiFetch<any>('/satellite/catalogue/search', {
        method: 'POST',
        body: JSON.stringify(payload),
      }));
    } catch (err: any) {
      setError(err.message || 'Copernicus catalogue search failed.');
    } finally {
      setCatalogueBusy(false);
    }
  };

  const summary = useMemo(() => {
    return {
      total: layers.length,
      verified: layers.filter((layer) => layer.verificationStatus === 'VERIFIED').length,
      unverified: layers.filter((layer) => layer.verificationStatus === 'UNVERIFIED').length,
      simulations: layers.filter((layer) => layer.isSimulation).length,
    };
  }, [layers]);

  return (
    <div className="flex flex-col gap-space-md">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Metric label="Imported layers" value={summary.total} tone="neutral" />
        <Metric label="Verified layers" value={summary.verified} tone="primary" />
        <Metric label="Unverified layers" value={summary.unverified} tone="warning" />
        <Metric label="Simulation layers" value={summary.simulations} tone={summary.simulations > 0 ? 'simulation' : 'neutral'} />
      </div>

      {notice && (
        <div className="rounded-lg bg-[#e9f3ed] border border-primary/20 px-3 py-2 text-[11px] font-semibold text-primary">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-error-container text-on-error-container px-3 py-2 text-[11px] font-semibold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-space-md">
        <SectionCard
          title="Import a satellite product"
          subtitle="Manual GeoJSON prototype. No automatic flood or damage detection."
          icon="satellite_alt"
          className="xl:col-span-1"
        >
          <form onSubmit={submit} className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-[11px] font-bold">
              Event name *
              <input
                value={form.eventName}
                onChange={(e) => setForm({ ...form, eventName: e.target.value })}
                placeholder="e.g. Mumbai flood extent, July 2026"
                className="h-11 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-bold">
              Area / product name *
              <input
                value={form.areaName}
                onChange={(e) => setForm({ ...form, areaName: e.target.value })}
                placeholder="e.g. Kurla West"
                className="h-11 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-bold">
              District *
              <input
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                placeholder="e.g. Mumbai Suburban"
                className="h-11 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-bold">
              Source organisation *
              <input
                value={form.sourceOrganisation}
                onChange={(e) => setForm({ ...form, sourceOrganisation: e.target.value })}
                placeholder="e.g. Copernicus EMS / ISRO / vendor"
                className="h-11 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-normal"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[11px] font-bold">
                Observed *
                <input
                  type="date"
                  value={form.observationDate}
                  onChange={(e) => setForm({ ...form, observationDate: e.target.value })}
                  className="h-11 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-normal"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-bold">
                Processed *
                <input
                  type="date"
                  value={form.processedDate}
                  onChange={(e) => setForm({ ...form, processedDate: e.target.value })}
                  className="h-11 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-normal"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-[11px] font-bold">
              Product reference *
              <input
                value={form.productReference}
                onChange={(e) => setForm({ ...form, productReference: e.target.value })}
                placeholder="Catalogue ID, delivery note or file reference"
                className="h-11 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-normal"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[11px] font-bold">
                Geometry precision
                <select
                  value={form.geometryPrecision}
                  onChange={(e) => setForm({ ...form, geometryPrecision: e.target.value })}
                  className="h-11 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-normal"
                >
                  <option value="APPROXIMATE">APPROXIMATE</option>
                  <option value="EXACT">EXACT</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-bold">
                Verification
                <select
                  value={form.verificationStatus}
                  onChange={(e) => setForm({ ...form, verificationStatus: e.target.value })}
                  className="h-11 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-normal"
                >
                  <option value="UNVERIFIED">UNVERIFIED</option>
                  <option value="VERIFIED">VERIFIED</option>
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1 text-[11px] font-bold">
              GeoJSON product *
              <input
                type="file"
                accept=".geojson,.json,application/geo+json,application/json"
                onChange={fileImport}
                className="block w-full text-[10.5px] text-on-surface-variant file:mr-2 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-surface-container-high file:text-on-surface file:text-[10.5px] file:font-bold"
              />
              {fileName && (
                <span className="text-[10px] font-normal text-primary">
                  {fileName} · {featureCount} feature{featureCount === 1 ? '' : 's'} · validated on save
                </span>
              )}
            </label>
            <label className="flex items-start gap-2 text-[10.5px] font-semibold rounded-lg border border-outline-variant/40 px-2 py-1.5">
              <input
                type="checkbox"
                checked={form.isSimulation}
                onChange={(e) => setForm({ ...form, isSimulation: e.target.checked })}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[#0A3A28]"
              />
              <span>
                SIMULATION layer
                <span className="block font-normal text-on-surface-variant">
                  Use for training/demo data only. It is visibly labelled and excluded from verified routing evidence.
                </span>
              </span>
            </label>
            <button type="submit" disabled={submitting || !geojson} className={primaryButton}>
              <span className="material-symbols-outlined text-[15px]">upload</span>
              {submitting ? 'Validating & importing…' : 'Import layer'}
            </button>
            <p className="text-[10px] text-on-surface-variant">
              The file must be a Polygon, MultiPolygon or FeatureCollection. Max 20,000 points.
              Imported metadata is stored with provenance; the server never invents a product date.
            </p>
          </form>
        </SectionCard>

        <SectionCard
          title="Imported layers"
          subtitle="Source, date and verification are displayed with every layer."
          icon="layers"
          className="xl:col-span-1"
          actions={
            <button type="button" onClick={load} disabled={loading} className={secondaryButton}>
              <span className="material-symbols-outlined text-[15px]">refresh</span>
              Refresh
            </button>
          }
        >
          {loading ? (
            <p className="text-xs text-on-surface-variant">Loading satellite layers…</p>
          ) : layers.length === 0 ? (
            <EmptyState
              icon="satellite_alt"
              title="No satellite layers imported"
              body="Import a preprocessed product. This prototype does not download or classify imagery automatically."
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              {layers.map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => setSelectedLayerId(layer.id)}
                  className={`w-full text-left rounded-lg border px-2.5 py-2 ${
                    selectedLayerId === layer.id
                      ? 'border-primary/50 bg-[#e9f3ed]'
                      : 'border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-[11px] font-bold">{layer.eventName}</span>
                    <div className="flex gap-1">
                      {layer.isSimulation && <StatusBadge tone="simulation">Sim</StatusBadge>}
                      <StatusBadge tone={layer.verificationStatus === 'VERIFIED' ? 'primary' : 'warning'}>
                        {layer.verificationStatus}
                      </StatusBadge>
                    </div>
                  </div>
                  <div className="text-[10px] text-on-surface-variant mt-0.5">
                    {layer.areaName} · {layer.sourceOrganisation} · observed {String(layer.observationDate).slice(0, 10)}
                  </div>
                  <div className="text-[10px] text-on-surface-variant">
                    {layer.featureCount} feature{layer.featureCount === 1 ? '' : 's'} · {layer.geometryPrecision} geometry
                  </div>
                </button>
              ))}
              <label className="flex items-center gap-2 text-[10px] mt-1">
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
                Show all layers on map
              </label>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Map preview"
          subtitle="Dashed outline = imported product. No damage assessment is inferred."
          icon="map"
          className="xl:col-span-1"
        >
          {displayLayers.length === 0 ? (
            <EmptyState title="Select a layer" body="Choose an imported layer to preview its geometry." />
          ) : (
            <div className="flex flex-col gap-2">
              <LeafletMap
                center={
                  selectedLayer?.bbox?.length === 4
                    ? [(selectedLayer.bbox[1] + selectedLayer.bbox[3]) / 2, (selectedLayer.bbox[0] + selectedLayer.bbox[2]) / 2]
                    : [19.076, 72.8777]
                }
                zoom={10}
                className="h-64 w-full rounded-xl overflow-hidden border border-outline-variant/30"
                polygons={mapPolygons}
              />
              {selectedLayer && !showAll && (
                <div className="rounded-lg border border-outline-variant/40 px-2.5 py-2 text-[10.5px]">
                  <div className="font-bold text-on-surface">{selectedLayer.eventName}</div>
                  <div className="text-on-surface-variant mt-0.5">
                    Source: {selectedLayer.sourceOrganisation}
                  </div>
                  <div className="text-on-surface-variant">
                    Observed {formatDateTime(selectedLayer.observationDate)} · processed{' '}
                    {formatDateTime(selectedLayer.processedDate)}
                  </div>
                  <div className="text-on-surface-variant">
                    Product ref: <span className="break-all">{selectedLayer.productReference}</span>
                  </div>
                  <div className="text-on-surface-variant">
                    Imported by {selectedLayer.uploadedByName || 'unknown'} · {formatDateTime(selectedLayer.createdAt)}
                  </div>
                  <p className="text-[10px] mt-1">{selectedLayer.note}</p>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Copernicus catalogue provider"
        subtitle="Metadata search only. No automatic flood detection or download pipeline."
        icon="cloud_sync"
        actions={
          <button type="button" onClick={() => setCatalogueOpen(!catalogueOpen)} className={secondaryButton}>
            <span className="material-symbols-outlined text-[15px]">
              {catalogueOpen ? 'expand_less' : 'expand_more'}
            </span>
            {catalogueOpen ? 'Hide catalogue search' : 'Open catalogue search'}
          </button>
        }
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={status?.configured ? 'primary' : 'warning'}>
              {status?.configured ? 'Credentials configured' : 'Credentials not configured'}
            </StatusBadge>
            <span className="text-[11px] text-on-surface-variant">{status?.provider || 'Copernicus Data Space Ecosystem'}</span>
          </div>
          <p className="text-[11px] text-on-surface-variant">
            {status?.note ||
              'Catalogue search requires COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET on the server. Manual import works without credentials.'}
          </p>
          {status?.capabilities && (
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge tone={status.capabilities.catalogueSearch ? 'primary' : 'neutral'}>
                Catalogue search: {status.capabilities.catalogueSearch ? 'available' : 'unavailable'}
              </StatusBadge>
              <StatusBadge tone="info">Manual GeoJSON import: available</StatusBadge>
              <StatusBadge tone="warning">Automatic flood detection: not implemented</StatusBadge>
            </div>
          )}

          {catalogueOpen && (
            <div className="flex flex-col gap-2 border-t border-outline-variant/30 pt-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                <label className="flex flex-col gap-0.5 text-[10px] font-bold">
                  West
                  <input value={bbox.west} onChange={(e) => setBbox({ ...bbox, west: e.target.value })} placeholder="72.7" className="h-8 px-2 rounded border border-outline-variant/40 text-[11px] font-normal" />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] font-bold">
                  South
                  <input value={bbox.south} onChange={(e) => setBbox({ ...bbox, south: e.target.value })} placeholder="18.8" className="h-8 px-2 rounded border border-outline-variant/40 text-[11px] font-normal" />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] font-bold">
                  East
                  <input value={bbox.east} onChange={(e) => setBbox({ ...bbox, east: e.target.value })} placeholder="73.1" className="h-8 px-2 rounded border border-outline-variant/40 text-[11px] font-normal" />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] font-bold">
                  North
                  <input value={bbox.north} onChange={(e) => setBbox({ ...bbox, north: e.target.value })} placeholder="19.3" className="h-8 px-2 rounded border border-outline-variant/40 text-[11px] font-normal" />
                </label>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                <label className="flex flex-col gap-0.5 text-[10px] font-bold">
                  From
                  <input type="date" value={bbox.from} onChange={(e) => setBbox({ ...bbox, from: e.target.value })} className="h-8 px-2 rounded border border-outline-variant/40 text-[11px] font-normal" />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] font-bold">
                  To
                  <input type="date" value={bbox.to} onChange={(e) => setBbox({ ...bbox, to: e.target.value })} className="h-8 px-2 rounded border border-outline-variant/40 text-[11px] font-normal" />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] font-bold md:col-span-2">
                  Collection
                  <select value={bbox.collection} onChange={(e) => setBbox({ ...bbox, collection: e.target.value })} className="h-8 px-2 rounded border border-outline-variant/40 text-[11px] font-normal">
                    <option value="sentinel-1-grd">sentinel-1-grd</option>
                    <option value="sentinel-2-l2a">sentinel-2-l2a</option>
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={searchCatalogue} disabled={catalogueBusy} className={primaryButton}>
                  <span className="material-symbols-outlined text-[15px]">search</span>
                  {catalogueBusy ? 'Searching…' : 'Search metadata'}
                </button>
                <span className="text-[10px] text-on-surface-variant">
                  Results are catalogue metadata, not flood extents.
                </span>
              </div>
              {catalogue && (
                <div className="rounded-lg border border-outline-variant/40 px-2.5 py-2 text-[10.5px]">
                  <div className="font-bold">{catalogue.note}</div>
                  {catalogue.products?.length > 0 && (
                    <ul className="mt-1 space-y-1 text-on-surface-variant">
                      {catalogue.products.map((product: any) => (
                        <li key={product.id} className="border-t border-outline-variant/20 pt-1 first:border-0 first:pt-0">
                          <span className="font-semibold text-on-surface">{product.collection}</span> ·{' '}
                          {product.acquiredAt ? formatDateTime(product.acquiredAt) : 'acquisition time unknown'}
                          {product.cloudCover !== null ? ` · cloud ${product.cloudCover}%` : ''}
                          <span className="block font-code-num break-all">{product.id}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
          <DataCaveat tone="warning">
            This satellite module is a manual-import prototype. It does not automatically detect
            damage, declare a building unsafe, or verify a hazard from imagery. Every layer keeps its
            source, observation date, processing date and verification status.
          </DataCaveat>
        </div>
      </SectionCard>
    </div>
  );
};
