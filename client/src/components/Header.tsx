import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAuth, User } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { LanguageSelector } from './LanguageSelector';

interface HeaderProps {
  onOpenEmergencyModal: () => void;
}

const NAV_KEYS = ['nav.home', 'nav.disasters', 'nav.guides', 'nav.resources'] as const;
const NAV_PATHS = ['/', '/alerts', '/guides', '/resources'] as const;

export const Header: React.FC<HeaderProps> = ({ onOpenEmergencyModal }) => {
  const { user, logout, loginAsDemoRole } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
      const target = getDashboardRoute(u.role);
      setMobileNavOpen(false);
      navigate(target);
    } catch (e) {
      console.error('Failed to switch demo role:', e);
    }
  };

  // Any navigation closes the drawers.
  useEffect(() => {
    setMobileNavOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Lock the page behind the mobile drawer.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileNavOpen]);

  const navLinks = NAV_KEYS.map((key, index) => ({ label: t(key), path: NAV_PATHS[index] }));

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const closeDrawers = useCallback(() => {
    setMobileNavOpen(false);
    setUserMenuOpen(false);
  }, []);

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-[90]">
        <div className="jg-header-bar pointer-events-auto jg-glass border-b border-outline-variant/35 shadow-sm">
          <div className="jg-header-inner jg-container flex items-center justify-between gap-2 px-[max(1rem,var(--jg-safe-left))] pr-[max(1rem,var(--jg-safe-right))]">
            {/* Brand */}
            <Link to="/" className="group flex min-h-[44px] min-w-0 shrink-0 items-center gap-2.5">
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-on-primary shadow-sm transition-transform duration-300 ease-out-expo group-hover:scale-105">
                <span
                  className="material-symbols-outlined text-[20px]"
                  aria-hidden="true"
                  style={{ fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" }}
                >
                  shield
                </span>
                <span
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_60%)]"
                  aria-hidden="true"
                />
              </span>
              <span className="flex min-w-0 flex-col leading-none">
                <span className="truncate font-headline-sm text-headline-sm font-bold tracking-tight text-primary">
                  JeevanGrid
                </span>
                <span className="mt-0.5 hidden truncate text-[10px] font-medium text-on-surface-variant sm:block">
                  {t('nav.tagline')}
                </span>
              </span>
            </Link>

            {/* Desktop navigation */}
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
              {navLinks.map((link) => {
                const active = isActive(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    aria-current={active ? 'page' : undefined}
                    className={`relative inline-flex min-h-[44px] items-center rounded-lg px-3 py-2 text-label-lg transition-colors duration-200 ${
                      active ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {active ? (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-primary"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    ) : null}
                    {link.label}
                  </Link>
                );
              })}
              {user && user.role !== 'CITIZEN' ? (
                <Link
                  to={getDashboardRoute(user.role)}
                  className="ml-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-primary-container px-3 py-2 text-label-lg font-semibold text-on-primary transition-colors hover:bg-primary"
                >
                  <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                    dashboard
                  </span>
                  {t('nav.opsDashboard')}
                </Link>
              ) : null}
            </nav>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <LanguageSelector />

              <button
                type="button"
                onClick={onOpenEmergencyModal}
                aria-label={t('nav.emergencyHelp')}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-error/45 bg-error-container/40 px-3 text-label-md font-bold text-error transition-all duration-200 hover:bg-error hover:text-on-error active:scale-95 sm:px-4"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  e911_emergency
                </span>
                <span className="hidden xl:inline">{t('nav.emergencyHelp')}</span>
              </button>

              {user ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((v) => !v)}
                    aria-expanded={userMenuOpen}
                    aria-haspopup="menu"
                    className="flex h-11 items-center gap-2 rounded-xl bg-surface-container pl-1 pr-2 transition-colors hover:bg-surface-container-high"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary">
                      <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                        person
                      </span>
                    </span>
                    <span className="hidden min-w-0 flex-col text-right leading-none xl:flex">
                      <span className="max-w-[9rem] truncate text-xs font-semibold text-on-surface">
                        {user.name}
                      </span>
                      <span className="mt-0.5 truncate text-[10px] uppercase text-on-surface-variant">
                        {user.role.replace('_', ' ')}
                      </span>
                    </span>
                  </button>

                  <AnimatePresence>
                    {userMenuOpen ? (
                      <motion.div
                        role="menu"
                        initial={reduce ? false : { opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={reduce ? undefined : { opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: reduce ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute right-0 top-[calc(100%+0.5rem)] z-[110] w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest py-1.5 shadow-xl"
                      >
                        <div className="border-b border-outline-variant/25 px-4 py-2.5">
                          <p className="truncate text-xs font-bold text-on-surface">{user.name}</p>
                          <p className="truncate text-[11px] text-on-surface-variant">{user.email}</p>
                          <span className="mt-1.5 inline-block rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold text-primary">
                            {user.role.replace('_', ' ')}
                          </span>
                        </div>
                        {user.role !== 'CITIZEN' ? (
                          <Link
                            to={getDashboardRoute(user.role)}
                            onClick={closeDrawers}
                            role="menuitem"
                            className="flex min-h-[44px] w-full items-center gap-2.5 px-4 py-2.5 text-xs text-on-surface transition-colors hover:bg-surface-container"
                          >
                            <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                              dashboard
                            </span>
                            Go to Ops Dashboard
                          </Link>
                        ) : null}
                        <Link
                          to="/report-emergency"
                          onClick={closeDrawers}
                          role="menuitem"
                          className="flex min-h-[44px] w-full items-center gap-2.5 px-4 py-2.5 text-xs text-on-surface transition-colors hover:bg-surface-container"
                        >
                          <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                            report_problem
                          </span>
                          Submit Incident Report
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            closeDrawers();
                            logout();
                            navigate('/');
                          }}
                          role="menuitem"
                          className="flex min-h-[44px] w-full items-center gap-2.5 px-4 py-2.5 text-xs text-error transition-colors hover:bg-error-container"
                        >
                          <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                            logout
                          </span>
                          Sign Out
                        </button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="inline-flex h-11 min-w-[2.75rem] items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-label-md font-semibold text-on-primary shadow-sm transition-all duration-200 hover:bg-primary-container active:scale-95 sm:px-4"
                >
                  <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                    person
                  </span>
                  <span className="hidden sm:inline">Login</span>
                </button>
              )}

              {/* Mobile menu trigger */}
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
                aria-expanded={mobileNavOpen}
                className="jg-icon-button lg:hidden"
              >
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                  menu
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile navigation drawer */}
      <AnimatePresence>
        {mobileNavOpen ? (
          <div className="fixed inset-0 z-[130] lg:hidden">
            <motion.div
              className="absolute inset-0 bg-on-surface/45 backdrop-blur-[2px]"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.22 }}
              onClick={() => setMobileNavOpen(false)}
              aria-hidden="true"
            />
            <motion.nav
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              initial={reduce ? false : { x: '-100%' }}
              animate={{ x: 0 }}
              exit={reduce ? undefined : { x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col bg-surface-container-lowest shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-outline-variant/30 px-4 py-3">
                <span className="text-sm font-bold text-on-surface">Menu</span>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close navigation"
                  className="jg-icon-button"
                >
                  <span className="material-symbols-outlined text-[21px]" aria-hidden="true">
                    close
                  </span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
                <div className="flex flex-col gap-1">
                  {navLinks.map((link) => {
                    const active = isActive(link.path);
                    return (
                      <Link
                        key={link.path}
                        to={link.path}
                        className={`flex min-h-[48px] items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${
                          active
                            ? 'bg-primary-container text-on-primary'
                            : 'text-on-surface hover:bg-surface-container'
                        }`}
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            active ? 'bg-on-primary' : 'bg-outline-variant'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="truncate">{link.label}</span>
                      </Link>
                    );
                  })}
                </div>

                {user && user.role !== 'CITIZEN' ? (
                  <Link
                    to={getDashboardRoute(user.role)}
                    className="mt-2 flex min-h-[48px] items-center gap-3 rounded-xl border border-outline-variant/40 bg-surface-container px-3 text-sm font-semibold text-primary"
                  >
                    <span className="material-symbols-outlined text-[19px]" aria-hidden="true">
                      dashboard
                    </span>
                    {t('nav.opsDashboard')}
                  </Link>
                ) : null}

                <div className="mt-4 border-t border-outline-variant/30 pt-3">
                  <p className="jg-eyebrow px-3 pb-2 text-on-surface-variant">Switch role</p>
                  <div className="flex flex-col gap-1">
                    {(
                      [
                        'DISTRICT_OFFICER',
                        'STATE_EOC',
                        'FIELD_RESPONDER',
                        'HEALTH_OFFICER',
                        'COMMUNITY_VOLUNTEER',
                      ] as User['role'][]
                    ).map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => void handleRoleSwitch(role)}
                        className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-left text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                      >
                        <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                          switch_account
                        </span>
                        {role.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-outline-variant/30 px-3 py-3 pb-[calc(0.75rem+var(--jg-safe-bottom))]">
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    onOpenEmergencyModal();
                  }}
                  className="jg-button-danger w-full"
                >
                  <span className="material-symbols-outlined text-[19px]" aria-hidden="true">
                    e911_emergency
                  </span>
                  {t('nav.emergencyHelp')}
                </button>
              </div>
            </motion.nav>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
};
