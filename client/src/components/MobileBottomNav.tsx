import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAuth, User } from '../context/AuthContext';

interface MobileNavProps {
  onOpenEmergencyModal: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

/**
 * Phone-only bottom navigation.
 *
 * A floating orb cannot live on a phone without covering something — on a
 * 360px screen it lands on top of the primary call to action. The bottom
 * bar owns that space instead: the page reserves room for it, nothing is
 * ever covered, and every destination stays one thumb-tap away.
 */
export const MobileBottomNav: React.FC<MobileNavProps> = ({ onOpenEmergencyModal }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(true);

  const items: NavItem[] = [
    { label: 'Home', path: '/', icon: 'home' },
    { label: 'Alerts', path: '/alerts', icon: 'notification_important' },
    { label: 'Report', path: '/report-emergency', icon: 'report_problem' },
    { label: 'Guides', path: '/guides', icon: 'menu_book' },
  ];

  // Hide while the reader scrolls down, reveal on the way up. Keeps the bar
  // out of the way without ever leaving the page uncovered.
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = Math.max(0, window.scrollY);
        const delta = y - lastY;
        if (Math.abs(delta) > 8) {
          setVisible(delta < 0 || y < 80);
          lastY = y;
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Reset on route change so the bar never hides the top of a new page.
  // (The route shell handles the scroll position itself.)
  useEffect(() => {
    setVisible(true);
  }, [location.pathname]);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const dashboardPath = (role: User['role']) => {
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

  return (
    <>
      {/* Reserve the space so page content is never covered by the bar. */}
      <div className="h-[calc(4.25rem+env(safe-area-inset-bottom))] sm:hidden" aria-hidden="true" />

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-[95] border-t border-outline-variant/40 bg-surface shadow-[0_-8px_24px_-12px_rgba(11,23,32,0.25)] sm:hidden"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: visible ? 'translateY(0)' : 'translateY(110%)',
          transition: reduce
            ? 'none'
            : 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <ul className="flex items-stretch justify-around">
          {items.map((item) => {
            const active = isActive(item.path);
            return (
              <li key={item.path} className="flex-1">
                <Link
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 py-2 transition-colors ${
                    active ? 'text-primary' : 'text-on-surface-variant'
                  }`}
                >
                  <span className="relative flex items-center justify-center">
                    {active ? (
                      <motion.span
                        layoutId="mobile-nav-active"
                        className="absolute -inset-x-3 -inset-y-1.5 rounded-xl bg-primary/10"
                        transition={
                          reduce
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 380, damping: 32 }
                        }
                      />
                    ) : null}
                    <span
                      className={`material-symbols-outlined relative text-[21px] ${
                        active ? 'font-bold' : ''
                      }`}
                      aria-hidden="true"
                      style={
                        active
                          ? { fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" }
                          : undefined
                      }
                    >
                      {item.icon}
                    </span>
                    <span className="relative text-[10px] font-bold leading-none">{item.label}</span>
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => {
                if (user && user.role !== 'CITIZEN') navigate(dashboardPath(user.role));
                else onOpenEmergencyModal();
              }}
              className="flex min-h-[64px] w-full flex-col items-center justify-center gap-1 px-1 py-2 text-error"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-error/[0.12]">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  {user && user.role !== 'CITIZEN' ? 'dashboard' : 'e911_emergency'}
                </span>
              </span>
              <span className="text-[10px] font-bold leading-none">
                {user && user.role !== 'CITIZEN' ? 'Ops' : 'Help'}
              </span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
};
