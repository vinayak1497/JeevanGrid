import React, { useEffect, useRef } from 'react';
import {
  BASEMAPS,
  BASEMAP_ORDER,
  OVERLAY_DEFS,
  PRESETS,
  type BasemapKey,
  type ClarityKey,
  type OverlayKey,
  type PresetKey,
} from '../map/mapStyles';

export interface LegendItem {
  shape: 'dot' | 'line' | 'square';
  color: string;
  label: string;
}

/** Dynamically drawn miniature basemap previews (no stock imagery). */
const BasemapThumb: React.FC<{ basemap: BasemapKey }> = ({ basemap }) => {
  const common = 'block w-[68px] h-[48px] rounded-md overflow-hidden shrink-0 border border-outline-variant/40';
  if (basemap === 'standard') {
    return (
      <svg viewBox="0 0 68 48" className={common} aria-hidden="true">
        <rect width="68" height="48" fill="#f2efe6" />
        <rect x="4" y="6" width="18" height="12" fill="#dce8d4" />
        <path d="M0 34 C 18 30, 30 38, 68 28" stroke="#7ea8d8" strokeWidth="4" fill="none" />
        <path d="M8 0 V48 M34 0 V48 M56 0 V48 M0 14 H68 M0 40 H68" stroke="#ffffff" strokeWidth="3" />
        <path d="M8 0 V48 M34 0 V48 M56 0 V48 M0 14 H68 M0 40 H68" stroke="#c9c4b4" strokeWidth="1" />
        <circle cx="46" cy="14" r="3" fill="#ba1a1a" />
      </svg>
    );
  }
  if (basemap === 'satellite') {
    return (
      <svg viewBox="0 0 68 48" className={common} aria-hidden="true">
        <rect width="68" height="48" fill="#2f3b2a" />
        <rect x="0" y="0" width="22" height="16" fill="#3d4c33" />
        <rect x="40" y="24" width="28" height="24" fill="#46543a" />
        <rect x="18" y="30" width="16" height="10" fill="#5a6b45" />
        <path d="M0 40 C 20 34, 40 42, 68 32" stroke="#31435c" strokeWidth="4" fill="none" />
        <path d="M6 0 C 10 16, 4 32, 12 48 M40 0 C 36 14, 46 30, 42 48" stroke="#d8d2bd" strokeWidth="1.4" fill="none" />
      </svg>
    );
  }
  if (basemap === 'terrain') {
    return (
      <svg viewBox="0 0 68 48" className={common} aria-hidden="true">
        <rect width="68" height="48" fill="#e9e2cf" />
        <path d="M34 6 L48 30 H20 Z" fill="#c9bd9c" />
        <path d="M34 6 L40 18 L34 22 L28 18 Z" fill="#f4efe2" />
        <ellipse cx="20" cy="36" rx="14" ry="5" fill="none" stroke="#a89a72" strokeWidth="1.2" />
        <ellipse cx="20" cy="39" rx="19" ry="7" fill="none" stroke="#a89a72" strokeWidth="1.2" />
        <ellipse cx="52" cy="38" rx="12" ry="5" fill="none" stroke="#a89a72" strokeWidth="1.2" />
      </svg>
    );
  }
  if (basemap === 'light') {
    return (
      <svg viewBox="0 0 68 48" className={common} aria-hidden="true">
        <rect width="68" height="48" fill="#fafafa" />
        <path d="M8 0 V48 M30 0 V48 M52 0 V48 M0 12 H68 M0 28 H68" stroke="#e3e3e3" strokeWidth="2.5" />
        <path d="M0 40 H68" stroke="#d2d2d2" strokeWidth="1.5" />
        <circle cx="44" cy="20" r="2.6" fill="#9aa5b1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 68 48" className={common} aria-hidden="true">
      <rect width="68" height="48" fill="#1c2433" />
      <path d="M8 0 V48 M30 0 V48 M52 0 V48 M0 12 H68 M0 28 H68" stroke="#3b4a63" strokeWidth="2" />
      <path d="M0 34 C 18 30, 30 38, 68 28" stroke="#4f7fb8" strokeWidth="3" fill="none" />
      <circle cx="44" cy="16" r="2.6" fill="#e8edf5" />
    </svg>
  );
};

interface MapPanelProps {
  basemap: BasemapKey;
  onBasemapChange: (b: BasemapKey) => void;
  preset: PresetKey | null;
  onPreset: (p: PresetKey) => void;
  clarity: ClarityKey;
  onClarity: (c: ClarityKey) => void;
  onResetView: () => void;
}

interface OverlaysPanelProps {
  activeOverlays: Set<OverlayKey>;
  onToggleOverlay: (o: OverlayKey) => void;
  overlayStatus: Partial<Record<OverlayKey, string>>;
  legend: LegendItem[];
}

export const MapLayerControl: React.FC<MapPanelProps> = ({
  basemap,
  onBasemapChange,
  preset,
  onPreset,
  clarity,
  onClarity,
  onResetView,
}) => {
  const [open, setOpen] = React.useState(false);
  const [render, setRender] = React.useState(false);
  const [entered, setEntered] = React.useState(false);
  const closeTimer = useRef<number | null>(null);

  const show = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setRender(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
    setOpen(true);
  };
  const hide = () => {
    setEntered(false);
    setOpen(false);
    closeTimer.current = window.setTimeout(() => setRender(false), 160);
  };

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => {
    if (!render) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [render]);

  return (
    <>
      {/* Layers trigger — top-right of the map */}
      <button
        onClick={() => (open ? hide() : show())}
        aria-expanded={open}
        aria-label="Map layers"
        className={`absolute top-3 right-3 z-[500] inline-flex items-center gap-1.5 pl-2.5 pr-3 h-9 rounded-lg text-xs font-bold border transition-colors ${
          open
            ? 'bg-primary-container text-on-primary border-transparent shadow-md'
            : 'bg-white text-on-surface border-outline-variant/50 shadow-md hover:bg-surface-container-low'
        }`}
      >
        <span className="material-symbols-outlined text-[18px]">layers</span>
        <span>Layers</span>
      </button>

      {render && (
        <>
          {/* Click-outside catcher (transparent, map-local) */}
          <div className="absolute inset-0 z-[500]" onClick={hide} aria-hidden="true" />

          {/* Floating panel: desktop card, mobile bottom sheet */}
          <div
            role="dialog"
            aria-label="Map view"
            className={`absolute z-[501] bg-white border border-outline-variant/50 shadow-xl rounded-2xl
              left-2 right-2 bottom-2 max-h-[70%] overflow-y-auto p-4
              sm:left-auto sm:right-3 sm:top-14 sm:bottom-auto sm:w-[320px] sm:max-h-[calc(100%-4.5rem)]
              transition-all duration-150 ease-out
              ${entered ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-1'}`}
          >
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-headline-sm text-sm font-bold text-on-surface">Map view</h4>
              <div className="flex items-center gap-1">
                <button
                  onClick={onResetView}
                  className="px-2 py-1 rounded-md text-[11px] font-bold text-secondary hover:bg-surface-container-low transition-colors"
                >
                  Reset view
                </button>
                <button
                  onClick={hide}
                  aria-label="Close layer panel"
                  className="w-7 h-7 rounded-md text-on-surface-variant hover:bg-surface-container-low flex items-center justify-center transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            {/* Basemap */}
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mt-2 mb-1.5">
              Base map
            </p>
            <div className="flex flex-col gap-1">
              {BASEMAP_ORDER.map((key) => {
                const def = BASEMAPS[key];
                const selected = basemap === key;
                return (
                  <button
                    key={key}
                    onClick={() => onBasemapChange(key)}
                    aria-pressed={selected}
                    className={`flex items-center gap-2.5 p-1.5 rounded-xl border text-left transition-colors ${
                      selected
                        ? 'border-primary bg-surface-container-low'
                        : 'border-transparent hover:bg-surface-container-low/60'
                    }`}
                  >
                    <BasemapThumb basemap={key} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-bold text-on-surface leading-tight">{def.name}</span>
                      <span className="block text-[10px] text-on-surface-variant leading-tight truncate">{def.description}</span>
                    </span>
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selected ? 'border-primary bg-primary' : 'border-outline-variant'
                      }`}
                      aria-hidden="true"
                    >
                      {selected && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Operational presets */}
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mt-3 mb-1.5">
              Operational view
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => onPreset(p.key)}
                  aria-pressed={preset === p.key}
                  title={p.description}
                  className={`px-2 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                    preset === p.key
                      ? 'bg-primary-container text-on-primary border-transparent'
                      : 'bg-surface-container-low text-on-surface border-outline-variant/30 hover:bg-surface-container'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Clarity */}
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mt-3 mb-1.5">
              Map clarity
            </p>
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Map clarity">
              {(['minimal', 'standard', 'detailed'] as ClarityKey[]).map((c) => (
                <button
                  key={c}
                  onClick={() => onClarity(c)}
                  aria-pressed={clarity === c}
                  className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold capitalize transition-colors ${
                    clarity === c
                      ? 'bg-surface-container-high text-primary border-primary/40'
                      : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
};

/**
 * Separate "Overlays" control docked just below the Layers button.
 * Houses all information-layer toggles plus the dynamic legend.
 */
export const MapOverlaysControl: React.FC<OverlaysPanelProps> = ({
  activeOverlays,
  onToggleOverlay,
  overlayStatus,
  legend,
}) => {
  const [open, setOpen] = React.useState(false);
  const [render, setRender] = React.useState(false);
  const [entered, setEntered] = React.useState(false);
  const closeTimer = useRef<number | null>(null);

  const show = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setRender(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
    setOpen(true);
  };
  const hide = () => {
    setEntered(false);
    setOpen(false);
    closeTimer.current = window.setTimeout(() => setRender(false), 160);
  };

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => {
    if (!render) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [render]);

  const activeCount = OVERLAY_DEFS.filter((d) => activeOverlays.has(d.key)).length;

  return (
    <>
      <button
        onClick={() => (open ? hide() : show())}
        aria-expanded={open}
        aria-label="Information layers"
        className={`absolute top-[60px] right-3 z-[500] inline-flex items-center gap-1.5 pl-2.5 pr-3 h-9 rounded-lg text-xs font-bold border transition-colors ${
          open
            ? 'bg-primary-container text-on-primary border-transparent shadow-md'
            : 'bg-white text-on-surface border-outline-variant/50 shadow-md hover:bg-surface-container-low'
        }`}
      >
        <span className="material-symbols-outlined text-[18px]">stack</span>
        <span>Overlays</span>
        <span
          className={`min-w-[20px] h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
            open ? 'bg-white/25 text-on-primary' : 'bg-surface-container-high text-primary'
          }`}
        >
          {activeCount}
        </span>
      </button>

      {render && (
        <>
          <div className="absolute inset-0 z-[500]" onClick={hide} aria-hidden="true" />

          <div
            role="dialog"
            aria-label="Information layers"
            className={`absolute z-[501] bg-white border border-outline-variant/50 shadow-xl rounded-2xl
              left-2 right-2 bottom-2 max-h-[70%] overflow-y-auto p-4
              sm:left-auto sm:right-3 sm:top-[104px] sm:bottom-auto sm:w-[320px] sm:max-h-[calc(100%-7.5rem)]
              transition-all duration-150 ease-out
              ${entered ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-1'}`}
          >
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-headline-sm text-sm font-bold text-on-surface">Information layers</h4>
              <button
                onClick={hide}
                aria-label="Close overlays panel"
                className="w-7 h-7 rounded-md text-on-surface-variant hover:bg-surface-container-low flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <p className="text-[11px] text-on-surface-variant mb-1">
              Data shown on top of the base map. Each layer toggles independently.
            </p>

            <div className="flex flex-col">
              {OVERLAY_DEFS.map((def) => {
                const on = activeOverlays.has(def.key);
                return (
                  <button
                    key={def.key}
                    role="switch"
                    aria-checked={on}
                    onClick={() => onToggleOverlay(def.key)}
                    className="flex items-center gap-2.5 py-1.5 border-b border-outline-variant/20 last:border-0 text-left"
                  >
                    <span
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 flex ${on ? 'bg-secondary justify-end' : 'bg-outline-variant/60 justify-start'}`}
                      aria-hidden="true"
                    >
                      <span className="w-4 h-4 rounded-full bg-white shadow" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-bold text-on-surface leading-tight">{def.label}</span>
                      <span className="block text-[10px] text-on-surface-variant leading-tight truncate">
                        {overlayStatus[def.key] || def.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {legend.length > 0 && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mt-3 mb-1.5">
                  Legend
                </p>
                <div className="flex flex-col gap-1">
                  {legend.map((item) => (
                    <span key={item.label} className="flex items-center gap-2 text-[11px] text-on-surface">
                      {item.shape === 'dot' && (
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      )}
                      {item.shape === 'square' && (
                        <span className="w-3 h-3 rounded-[3px] shrink-0" style={{ backgroundColor: item.color }} />
                      )}
                      {item.shape === 'line' && (
                        <span className="w-5 h-0 shrink-0 border-t-[3px]" style={{ borderColor: item.color }} />
                      )}
                      <span>{item.label}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
};
