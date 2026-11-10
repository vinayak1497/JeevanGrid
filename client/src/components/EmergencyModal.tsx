import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { Sheet } from './ui/Sheet';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Global emergency dialer.
 *
 * On a phone it is a bottom sheet so the numbers are always reachable with a
 * thumb and the list never overflows. Dial buttons are large enough to hit
 * while panicking.
 */
export const EmergencyModal: React.FC<EmergencyModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const helplines = [
    {
      title: 'National Emergency Support (Police / All-Hazard)',
      number: '112',
      color: 'bg-error text-on-error',
      badge: 'Immediate Dispatch',
      desc: 'Unified all-India emergency lifeline for imminent danger, police intervention, or life threats.',
    },
    {
      title: 'National Disaster Response Force (NDRF)',
      number: '1078',
      color: 'bg-primary-container text-on-primary',
      badge: 'Flood / Search & Rescue',
      desc: 'National headquarters control room for flood rescues, building collapses, and boat deployments.',
    },
    {
      title: 'Ambulance & Trauma Medical Care',
      number: '108',
      color: 'bg-secondary text-on-secondary',
      badge: 'Medical Transport',
      desc: 'Free 24/7 advanced life-support ambulances with trained paramedics.',
    },
    {
      title: 'Fire Brigade Services',
      number: '101',
      color: 'bg-primary text-on-primary',
      badge: 'Fire & Hazardous Materials',
      desc: 'Urban fire emergencies, industrial hazards, and localized rescue operations.',
    },
    {
      title: 'Women Emergency Helpline',
      number: '1091',
      color: 'bg-surface-container-high text-on-surface',
      badge: 'Protection & Safety',
      desc: '24/7 dedicated support and immediate rescue dispatch for women in distress.',
    },
  ];

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title={t('emergency.title')}
      description={t('emergency.sub')}
      size="md"
      footer={
        <p className="text-center text-[11px] leading-relaxed text-on-surface-variant">
          {t('emergency.footer')}
        </p>
      }
    >
      <div className="flex flex-col gap-2.5">
        {helplines.map((line) => (
          <div
            key={line.number}
            className="flex flex-col gap-3 rounded-2xl border border-outline-variant/35 bg-surface-container-low p-3.5 transition-colors hover:bg-surface-container sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-bold text-on-surface">{line.title}</span>
                <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
                  {line.badge}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-on-surface-variant">{line.desc}</p>
            </div>
            <a
              href={`tel:${line.number}`}
              className={`inline-flex min-h-[48px] shrink-0 items-center justify-center gap-1.5 rounded-xl px-5 font-code-num text-base font-bold shadow-sm transition-transform active:scale-95 ${line.color}`}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                call
              </span>
              <span>{line.number}</span>
            </a>
          </div>
        ))}

        <div className="mt-1 flex flex-col gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-high/50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-on-surface">{t('emergency.reportTitle')}</h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-on-surface-variant">
              {t('emergency.reportSub')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate('/report-emergency');
            }}
            className="jg-button-primary shrink-0"
          >
            {t('emergency.reportBtn')}
          </button>
        </div>
      </div>
    </Sheet>
  );
};
