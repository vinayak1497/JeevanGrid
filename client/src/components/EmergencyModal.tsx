import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-xs">
      <div className="bg-surface-container-lowest w-full max-w-xl rounded-2xl shadow-2xl border border-outline-variant/40 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-space-lg bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <div className="w-8 h-8 rounded-full bg-error flex items-center justify-center text-on-error">
              <span className="material-symbols-outlined text-[18px]">e911_emergency</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">{t('emergency.title')}</h3>
              <p className="font-label-sm text-[11px] text-on-surface-variant">{t('emergency.sub')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('emergency.close')}
            className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-space-lg overflow-y-auto flex flex-col gap-space-sm">
          {helplines.map((line) => (
            <div
              key={line.number}
              className="p-space-md rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors border border-outline-variant/30 flex items-center justify-between gap-space-md"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-sm font-bold text-on-surface">{line.title}</span>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-[10px] font-semibold text-on-surface-variant">
                    {line.badge}
                  </span>
                </div>
                <p className="font-body-sm text-xs text-on-surface-variant">{line.desc}</p>
              </div>
              <a
                href={`tel:${line.number}`}
                className={`px-4 py-2 rounded-lg font-code-num text-sm font-bold shadow-xs flex items-center gap-1.5 whitespace-nowrap ${line.color}`}
              >
                <span className="material-symbols-outlined text-[16px]">call</span>
                <span>{line.number}</span>
              </a>
            </div>
          ))}

          {/* Alternate rapid citizen actions */}
          <div className="mt-space-xs p-space-md rounded-xl bg-surface-container-high/50 flex flex-col sm:flex-row items-center justify-between gap-space-sm border border-outline-variant/20">
            <div className="text-left">
              <h4 className="text-xs font-bold text-on-surface">{t('emergency.reportTitle')}</h4>
              <p className="text-[11px] text-on-surface-variant">{t('emergency.reportSub')}</p>
            </div>
            <button
              onClick={() => {
                onClose();
                navigate('/report-emergency');
              }}
              className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold whitespace-nowrap"
            >
              {t('emergency.reportBtn')}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-space-md bg-surface-container-low border-t border-outline-variant/30 text-center">
          <p className="font-label-sm text-[11px] text-on-surface-variant">
            {t('emergency.footer')}
          </p>
        </div>
      </div>
    </div>
  );
};
