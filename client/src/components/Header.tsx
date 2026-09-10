import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, User } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { LanguageSelector } from './LanguageSelector';

interface HeaderProps {
  onOpenEmergencyModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenEmergencyModal }) => {
  const { user, logout, loginAsDemoRole } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [demoMenuOpen, setDemoMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const getDashboardRoute = (role: User['role']) => {
    switch (role) {
      case 'DISTRICT_OFFICER':
        return '/dashboard/district';
      case 'FIELD_RESPONDER':
        return '/dashboard/responder';
      case 'HEALTH_OFFICER':
        return '/dashboard/health';
      case 'STATE_EOC':
        return '/dashboard/state';
      case 'COMMUNITY_VOLUNTEER':
        return '/dashboard/volunteer';
      default:
        return '/';
    }
  };

  const handleRoleSwitch = async (role: User['role']) => {
    try {
      const u = await loginAsDemoRole(role);
      setDemoMenuOpen(false);
      const target = getDashboardRoute(u.role);
      navigate(target);
    } catch (e) {
      console.error('Failed to switch demo role:', e);
    }
  };

  const navLinks = [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.disasters'), path: '/alerts' },
    { label: t('nav.guides'), path: '/guides' },
    { label: t('nav.resources'), path: '/resources' },
    { label: t('nav.assistant'), path: '/assistant' },
  ];

  return (
    <header className="fixed top-4 left-0 right-0 w-full z-50 px-margin-mobile lg:px-margin-desktop pointer-events-none">
      <div className="max-w-container-max mx-auto pointer-events-auto bg-white/70 backdrop-blur-md rounded-2xl shadow-sm border border-white/40 transition-all">
      {/* Top Demo Bar for Hackathon Judges */}
      <div className="rounded-t-2xl bg-surface-container-high/80 border-b border-outline-variant/30 px-margin-mobile lg:px-margin-desktop py-1 text-xs flex items-center justify-between text-on-surface-variant">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-surface-tint"></span>
          <span className="font-semibold text-primary">{t('nav.demoMode')}</span>
          <span>{t('nav.loggedInAs')} <strong className="text-on-surface uppercase">{user ? user.role.replace('_', ' ') : t('nav.guest')}</strong></span>
        </div>
        <div className="relative">
          <button
            onClick={() => setDemoMenuOpen(!demoMenuOpen)}
            className="inline-flex items-center gap-1 font-semibold text-primary hover:text-primary-container px-2 py-0.5 rounded bg-surface-container-lowest shadow-xs"
          >
            <span>{t('nav.switchRole')}</span>
            <span className="material-symbols-outlined text-[14px]">expand_more</span>
          </button>
          {demoMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-surface-container-lowest rounded-lg shadow-lg border border-outline-variant/40 py-1 z-50">
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-on-surface-variant border-b border-outline-variant/20">
                {t('nav.selectRole')}
              </div>
              <button
                onClick={() => handleRoleSwitch('CITIZEN')}
                className="w-full text-left px-3 py-1.5 hover:bg-surface-container-low text-xs flex items-center justify-between"
              >
                <span>Citizen</span>
                {user?.role === 'CITIZEN' && <span className="text-surface-tint">✓</span>}
              </button>
              <button
                onClick={() => handleRoleSwitch('DISTRICT_OFFICER')}
                className="w-full text-left px-3 py-1.5 hover:bg-surface-container-low text-xs flex items-center justify-between"
              >
                <span>District Officer (DDMA)</span>
                {user?.role === 'DISTRICT_OFFICER' && <span className="text-surface-tint">✓</span>}
              </button>
              <button
                onClick={() => handleRoleSwitch('FIELD_RESPONDER')}
                className="w-full text-left px-3 py-1.5 hover:bg-surface-container-low text-xs flex items-center justify-between"
              >
                <span>Field Responder (NDRF)</span>
                {user?.role === 'FIELD_RESPONDER' && <span className="text-surface-tint">✓</span>}
              </button>
              <button
                onClick={() => handleRoleSwitch('HEALTH_OFFICER')}
                className="w-full text-left px-3 py-1.5 hover:bg-surface-container-low text-xs flex items-center justify-between"
              >
                <span>Health Officer</span>
                {user?.role === 'HEALTH_OFFICER' && <span className="text-surface-tint">✓</span>}
              </button>
              <button
                onClick={() => handleRoleSwitch('STATE_EOC')}
                className="w-full text-left px-3 py-1.5 hover:bg-surface-container-low text-xs flex items-center justify-between"
              >
                <span>State EOC Officer</span>
                {user?.role === 'STATE_EOC' && <span className="text-surface-tint">✓</span>}
              </button>
              <button
                onClick={() => handleRoleSwitch('COMMUNITY_VOLUNTEER')}
                className="w-full text-left px-3 py-1.5 hover:bg-surface-container-low text-xs flex items-center justify-between"
              >
                <span>Community Volunteer</span>
                {user?.role === 'COMMUNITY_VOLUNTEER' && <span className="text-surface-tint">✓</span>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Navbar */}
      <div className="rounded-b-2xl h-16 max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop flex items-center justify-between gap-space-md">
        {/* Brand Logo & Name */}
        <Link to="/" className="flex items-center gap-space-sm group">
          <img
            alt="JeevanGrid Brand Logo"
            className="h-8 w-auto object-contain"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuD0_F511bDxbm-42RdE_16-7A2-vX8jkKf-9E5obOVePqeyCQmsFGPDNiWB5qZiCCjQ75JK9ZB3LkOYwkApxB1iDJZ0UGohHLt5eexSUx9gkKhgcris0y0hj44TCKqwI3AeoHLUaTjZG7QqcD-xlJOWoyNPvBS1zT2gGfCv-MYhfpmCvhp1p8QUeGiENfXREL-5pplKGHuTUAe3tfd8jvp9WQEEn8cOfhNjVdlCk9YcEKypaIqGTrMx"
          />
          <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-primary leading-tight tracking-tight font-bold group-hover:text-primary-container transition-colors">
                JeevanGrid
              </span>
              <span className="font-label-sm text-[11px] text-on-surface-variant hidden sm:inline-block">
                {t('nav.tagline')}
              </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden xl:flex items-center gap-space-lg">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`font-label-lg text-label-lg transition-colors ${
                  isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {user && user.role !== 'CITIZEN' && (
            <Link
              to={getDashboardRoute(user.role)}
              className="font-label-lg text-label-lg text-secondary font-bold hover:text-on-secondary-container transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[18px]">dashboard</span>
              <span>{t('nav.opsDashboard')}</span>
            </Link>
          )}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-space-xs sm:gap-space-sm">
          {/* Global language selector — citizen selects once, whole app follows */}
          <LanguageSelector />

          {/* Emergency Help Action Button */}
          <button
            onClick={onOpenEmergencyModal}
            aria-label={t('nav.emergencyHelp')}
            className="inline-flex items-center justify-center px-space-md py-1.5 rounded-full border border-error text-error hover:bg-error-container hover:text-on-error-container transition-all font-label-md text-label-md font-semibold"
          >
            <span className="material-symbols-outlined mr-1 text-[16px]">e911_emergency</span>
            <span className="hidden md:inline">{t('nav.emergencyHelp')}</span>
          </button>

          {/* User Profile or Login */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors"
              >
                <div className="flex flex-col text-right hidden md:flex">
                  <span className="text-xs font-semibold text-on-surface leading-tight">{user.name}</span>
                  <span className="text-[10px] text-on-surface-variant uppercase">{user.role.replace('_', ' ')}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary">
                  <span className="material-symbols-outlined text-[18px]">person</span>
                </div>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/30 py-2 z-50">
                  <div className="px-4 py-2 border-b border-outline-variant/20">
                    <p className="text-xs font-bold text-on-surface">{user.name}</p>
                    <p className="text-[11px] text-on-surface-variant truncate">{user.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-surface-container-high text-[10px] font-semibold text-primary">
                      {user.role}
                    </span>
                  </div>
                  {user.role !== 'CITIZEN' && (
                    <Link
                      to={getDashboardRoute(user.role)}
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full text-left px-4 py-2 hover:bg-surface-container-low text-xs text-on-surface flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[16px]">dashboard</span>
                      <span>Go to Ops Dashboard</span>
                    </Link>
                  )}
                  <Link
                    to="/report-emergency"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full text-left px-4 py-2 hover:bg-surface-container-low text-xs text-on-surface flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">report_problem</span>
                    <span>Submit Incident Report</span>
                  </Link>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                      navigate('/');
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-error-container hover:text-on-error-container text-xs text-error flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-space-md py-1.5 rounded-lg bg-primary-container text-on-primary hover:bg-primary transition-all font-label-md text-label-md shadow-xs font-medium"
            >
              {t('nav.login')}
            </Link>
          )}
        </div>
      </div>
      </div>
    </header>
  );
};
