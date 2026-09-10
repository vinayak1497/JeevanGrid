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
    <main className="w-full pt-28 pb-space-3xl min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl p-space-xl shadow-lg border border-outline-variant/30 flex flex-col gap-space-md">
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
          className="w-full py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary-container transition-all flex items-center justify-center gap-1.5 shadow-xs"
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
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <button
              onClick={() => handleFastDemoLogin('DISTRICT_OFFICER')}
              className="p-1.5 rounded bg-surface-container-low hover:bg-surface-container text-left border border-outline-variant/20 truncate"
            >
              🏛️ District Officer
            </button>
            <button
              onClick={() => handleFastDemoLogin('FIELD_RESPONDER')}
              className="p-1.5 rounded bg-surface-container-low hover:bg-surface-container text-left border border-outline-variant/20 truncate"
            >
              🚨 Field Responder
            </button>
            <button
              onClick={() => handleFastDemoLogin('HEALTH_OFFICER')}
              className="p-1.5 rounded bg-surface-container-low hover:bg-surface-container text-left border border-outline-variant/20 truncate"
            >
              🏥 Health Officer
            </button>
            <button
              onClick={() => handleFastDemoLogin('STATE_EOC')}
              className="p-1.5 rounded bg-surface-container-low hover:bg-surface-container text-left border border-outline-variant/20 truncate"
            >
              🗺️ State EOC
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-on-surface-variant pt-1">
          Don't have an account?{' '}
          <Link to="/register" className="font-bold text-primary hover:underline">
            Register as Citizen
          </Link>
        </div>
      </div>
    </main>
  );
};
