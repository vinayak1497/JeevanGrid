import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, User } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export const LoginPage: React.FC = () => {
  const { login, loginAsDemoRole } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTargetDashboard = (role: User['role']) => {
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const u = await login(email, password);
      navigate(getTargetDashboard(u.role));
    } catch (err: any) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFastDemoLogin = async (role: User['role']) => {
    setLoading(true);
    setError(null);
    try {
      const u = await loginAsDemoRole(role);
      navigate(getTargetDashboard(u.role));
    } catch (err: any) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="jg-page flex min-h-[100dvh] items-center justify-center bg-surface pb-space-3xl">
      <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl p-space-xl shadow-lg border border-outline-variant/30 flex flex-col gap-space-md">
        {/* Citizen-First Access Distinction */}
        <div className="flex flex-col sm:flex-row gap-2 mb-2">
          <div className="flex-1 rounded-t-xl bg-primary/10 border border-primary/20 p-2 text-xs text-primary font-medium">
            For Citizens: Instant Access<br/>No account or sign-up required to access emergency assistance, report an incident or view public safety information.
          </div>
          <div className="flex-1 rounded-t-xl bg-secondary/10 border border-secondary/20 p-2 text-xs text-secondary font-medium">
            For Officials & Response Teams<br/>Sign in with your assigned credentials to access your role-specific operational dashboard.
          </div>
        </div>

        <div className="text-center">
          <img
            alt="JeevanGrid Logo"
            className="h-9 w-auto mx-auto object-contain mb-2"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuD0_F511bDxbm-42RdE_16-7A2-vX8jkKf-9E5obOVePqeyCQmsFGPDNiWB5qZiCCjQ75JK9ZB3LkOYwkApxB1iDJZ0UGohHLt5eexSUx9gkKhgcris0y0hj44TCKqwI3AeoHLUaTjZG7QqcD-xlJOWoyNPvBS1zT2gGfCv-MYhfpmCvhp1p8QUeGiENfXREL-5pplKGHuTUAe3tfd8jvp9WQEEn8cOfhNjVdlCk9YcEKypaIqGTrMx"
          />
          <h1 className="font-headline-lg text-xl font-bold text-on-surface">{t('auth.welcome')}</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">{t('auth.welcomeSub')}</p>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-error-container text-on-error-container text-xs font-semibold">
            {error}
          </div>
        )}

        {/* 1-Click Fast Citizen Access */}
        <button
          onClick={() => handleFastDemoLogin('CITIZEN')}
          disabled={loading}
          className="flex w-full min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-xs font-bold text-on-primary shadow-sm transition-all hover:bg-primary-container"
        >
          <span className="material-symbols-outlined text-[18px]">verified_user</span>
          <span>Continue as Citizen (Instant Access)</span>
        </button>

        <div className="flex items-center my-1">
          <div className="flex-1 h-px bg-outline-variant/30"></div>
          <span className="px-3 text-[11px] text-on-surface-variant uppercase font-medium">Or enter credentials</span>
          <div className="flex-1 h-px bg-outline-variant/30"></div>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-space-sm">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-on-surface">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. citizen@demo.com"
              className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs border border-outline-variant/30 outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-on-surface">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password123!"
              className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs border border-outline-variant/30 outline-none focus:border-primary"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-11 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-bold text-xs transition-all shadow-xs disabled:opacity-60"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Quick Demo Predefined Roles */}
        <div className="mt-space-xs pt-space-sm border-t border-outline-variant/20">
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1.5 text-center">
            Demo Evaluation Accounts (Password: Password123!)
          </span>
          <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
            {(
              [
                ['DISTRICT_OFFICER', 'District Officer'],
                ['FIELD_RESPONDER', 'Field Responder'],
                ['HEALTH_OFFICER', 'Health Officer'],
                ['STATE_EOC', 'State EOC'],
              ] as const
            ).map(([role, label]) => (
              <button
                key={role}
                type="button"
                onClick={() => handleFastDemoLogin(role)}
                className="min-h-[44px] rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-left text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-1 text-center text-xs text-on-surface-variant">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="inline-flex min-h-[44px] items-center font-bold text-primary hover:underline"
          >
            Register as Citizen
          </Link>
        </div>
      </div>
    </main>
  );
};
