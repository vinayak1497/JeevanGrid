import React, { useState } from 'react';
import { ImpactAssessmentPanel } from './ImpactAssessmentPanel';
import { CommunityIntelligencePanel } from './CommunityIntelligencePanel';
import { PlaybookPanel } from './PlaybookPanel';
import { AcknowledgementPanel } from './AcknowledgementPanel';

export interface DistrictIntelligenceWorkspaceProps {
  district: string;
  onChanged: () => void;
}

const MODULES = [
  {
    id: 'exposure',
    label: 'Exposure',
    icon: 'crisis_alert',
    title: 'Impact-based exposure',
    description: 'Estimate population and infrastructure inside a warning, location, or scenario extent.',
  },
  {
    id: 'community',
    label: 'Community',
    icon: 'forum',
    title: 'Community intelligence',
    description: 'Review the report pipeline and verify field reports with human judgement.',
  },
  {
    id: 'playbooks',
    label: 'Playbooks',
    icon: 'checklist',
    title: 'Operational playbooks',
    description: 'Review trigger suggestions, activate task lists, and track completion evidence.',
  },
  {
    id: 'acknowledgements',
    label: 'Acknowledgements',
    icon: 'how_to_reg',
    title: 'Citizen acknowledgements',
    description: 'See how citizens responded and follow up with assistance requests.',
  },
] as const;

type ModuleId = (typeof MODULES)[number]['id'];

const PANEL_ID = 'district-intelligence-panel';

/**
 * Full-width workspace for the dense district intelligence modules.
 *
 * Each module is designed for a wide canvas, so they are shown one at a time
 * rather than squeezed into equal-width cards. Only the active module mounts,
 * which also avoids initialising hidden maps at zero size.
 */
export const DistrictIntelligenceWorkspace: React.FC<DistrictIntelligenceWorkspaceProps> = ({
  district,
  onChanged,
}) => {
  const [active, setActive] = useState<ModuleId>('exposure');

  const selectModule = (id: ModuleId) => setActive(id);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();

    const currentIndex = MODULES.findIndex((module) => module.id === active);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % MODULES.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + MODULES.length) % MODULES.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = MODULES.length - 1;

    const nextModule = MODULES[nextIndex];
    setActive(nextModule.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`intel-tab-${nextModule.id}`)?.focus();
    });
  };

  return (
    <section
      aria-labelledby="district-intelligence-heading"
      className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-low shadow-sm"
    >
      <div className="border-b border-outline-variant/30 bg-surface-container-lowest px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-secondary">
              Intelligence workspace
            </p>
            <h2
              id="district-intelligence-heading"
              className="mt-1 font-headline-sm text-lg font-bold tracking-tight text-on-surface"
            >
              District decision support
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-on-surface-variant">
              Four operational modules for exposure, community reports, playbooks, and citizen
              acknowledgements. Outputs are advisory unless a human has verified them.
            </p>
          </div>
          <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-bold text-primary">
            <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
              verified_user
            </span>
            Human verification required
          </span>
        </div>

        <div
          role="tablist"
          aria-label="District intelligence modules"
          onKeyDown={handleTabKeyDown}
          className="no-scrollbar mt-4 grid grid-cols-2 gap-1.5 sm:flex sm:overflow-x-auto sm:pb-1"
        >
          {MODULES.map((module) => {
            const selected = active === module.id;
            return (
              <button
                key={module.id}
                id={`intel-tab-${module.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={PANEL_ID}
                tabIndex={selected ? 0 : -1}
                title={module.description}
                onClick={() => selectModule(module.id)}
                className={`inline-flex min-h-[44px] w-full items-center justify-start gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:w-auto sm:shrink-0 ${
                  selected
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  {module.icon}
                </span>
                {module.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={`intel-tab-${active}`}
        className="bg-surface-container-low/40 p-4 sm:p-5"
      >
        {active === 'exposure' && <ImpactAssessmentPanel district={district} />}
        {active === 'community' && (
          <CommunityIntelligencePanel district={district} onChanged={onChanged} />
        )}
        {active === 'playbooks' && <PlaybookPanel district={district} onChanged={onChanged} />}
        {active === 'acknowledgements' && (
          <AcknowledgementPanel district={district} onChanged={onChanged} />
        )}
      </div>
    </section>
  );
};
