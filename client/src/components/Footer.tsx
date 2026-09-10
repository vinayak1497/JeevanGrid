import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';

export const Footer: React.FC = () => {
  const { t } = useLanguage();
  return (
    <footer className="w-full bg-surface-container-low mt-space-3xl py-space-3xl border-t border-outline-variant/30">
      <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-space-xl mb-space-2xl">
          {/* Brand Col */}
          <div className="lg:col-span-2 flex flex-col gap-space-sm">
            <div className="flex items-center gap-space-xs">
              <img
                alt="JeevanGrid Brand Logo"
                className="h-7 w-auto object-contain"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD0_F511bDxbm-42RdE_16-7A2-vX8jkKf-9E5obOVePqeyCQmsFGPDNiWB5qZiCCjQ75JK9ZB3LkOYwkApxB1iDJZ0UGohHLt5eexSUx9gkKhgcris0y0hj44TCKqwI3AeoHLUaTjZG7QqcD-xlJOWoyNPvBS1zT2gGfCv-MYhfpmCvhp1p8QUeGiENfXREL-5pplKGHuTUAe3tfd8jvp9WQEEn8cOfhNjVdlCk9YcEKypaIqGTrMx"
              />
              <span className="font-headline-sm text-headline-sm text-primary font-bold">JeevanGrid</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
              {t('footer.tagline')}
            </p>
            <div className="flex flex-wrap gap-space-xs mt-space-xs">
              <div className="inline-flex items-center px-space-xs py-space-xxs rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm">
                <span className="w-2 h-2 rounded-full bg-surface-tint mr-1.5 animate-pulse"></span>
                Operational Grid 99.98%
              </div>
              <div className="inline-flex items-center px-space-xs py-space-xxs rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm">
                <span className="material-symbols-outlined mr-1 text-[14px]">accessibility_new</span>
                WCAG 2.1 AAA Compliant
              </div>
            </div>
          </div>

          {/* Platform Links */}
          <div className="flex flex-col gap-space-xs">
            <h4 className="font-headline-sm text-headline-sm text-on-surface mb-space-xs font-semibold">{t('footer.platform')}</h4>
            <Link to="/" className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors">{t('nav.home')}</Link>
            <Link to="/alerts" className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors">{t('nav.disasters')}</Link>
            <Link to="/resources" className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors">{t('nav.resources')}</Link>
            <Link to="/assistant" className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors">{t('nav.assistant')}</Link>
          </div>

          {/* Preparedness */}
          <div className="flex flex-col gap-space-xs">
            <h4 className="font-headline-sm text-headline-sm text-on-surface mb-space-xs font-semibold">{t('footer.preparedness')}</h4>
            <Link to="/guides" className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors">Safety Protocols</Link>
            <Link to="/guides/flood" className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors">Flood Evacuation Plans</Link>
            <Link to="/guides/cyclone" className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors">Cyclone Readiness</Link>
            <Link to="/guides/earthquake" className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors">Family Emergency Kits</Link>
          </div>

          {/* Emergency Directory */}
          <div className="flex flex-col gap-space-xs">
            <h4 className="font-headline-sm text-headline-sm text-on-surface mb-space-xs font-semibold">{t('footer.directory')}</h4>
            <div className="flex flex-col gap-space-xxs font-body-sm text-body-sm">
              <div className="flex justify-between items-center py-space-xxs border-b border-outline-variant/20">
                <span className="text-on-surface-variant text-xs">Disaster Helpline (NDRF)</span>
                <a href="tel:1078" className="font-code-num text-code-num text-primary font-bold hover:underline">1078</a>
              </div>
              <div className="flex justify-between items-center py-space-xxs border-b border-outline-variant/20">
                <span className="text-on-surface-variant text-xs">Medical / Ambulance</span>
                <a href="tel:108" className="font-code-num text-code-num text-primary font-bold hover:underline">108</a>
              </div>
              <div className="flex justify-between items-center py-space-xxs border-b border-outline-variant/20">
                <span className="text-on-surface-variant text-xs">National Emergency (Police)</span>
                <a href="tel:112" className="font-code-num text-code-num text-error font-bold hover:underline">112</a>
              </div>
              <div className="flex justify-between items-center py-space-xxs">
                <span className="text-on-surface-variant text-xs">Women Helpline</span>
                <a href="tel:1091" className="font-code-num text-code-num text-primary font-bold hover:underline">1091</a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Legal & Accreditations */}
        <div className="pt-space-lg border-t border-outline-variant/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md font-body-sm text-body-sm text-on-surface-variant">
          <div className="flex flex-col gap-space-xxs max-w-2xl">
            <p className="font-label-sm text-[11px] text-on-surface-variant leading-relaxed">
              {t('footer.notice')}
            </p>
            <p className="font-label-sm text-[11px] text-on-surface-variant mt-1">
              {t('footer.rights')}
            </p>
          </div>
          <div className="flex items-center gap-space-md text-xs">
            <span className="text-secondary font-medium">Calm Authority</span>
            <span>•</span>
            <span className="text-primary font-medium">Civic Solace</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
