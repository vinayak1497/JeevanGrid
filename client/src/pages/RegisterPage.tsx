import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const RegisterPage: React.FC = () => {
  const { registerCitizen } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('Mumbai Suburban');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await registerCitizen({ name, email, password, phone, district });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full pt-28 pb-space-3xl min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl p-space-xl shadow-lg border border-outline-variant/30 flex flex-col gap-space-md">
        <div className="text-center">
          <h1 className="font-headline-lg text-xl font-bold text-on-surface">Citizen Registration</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Join the JeevanGrid verified community resilience grid
          </p>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-error-container text-on-error-container text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="flex flex-col gap-space-sm">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-on-surface">Full Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Nair"
              className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs border border-outline-variant/30 outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-on-surface">Email Address *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="priya@example.com"
              className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs border border-outline-variant/30 outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-on-surface">Phone Number (For Alerts)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98200 99887"
              className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs border border-outline-variant/30 outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-on-surface">District</label>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs border border-outline-variant/30 outline-none focus:border-primary"
            >
              <option value="Mumbai Suburban">Mumbai Suburban</option>
              <option value="Mumbai City">Mumbai City</option>
              <option value="Thane">Thane</option>
              <option value="Pune">Pune</option>
              <option value="Kamrup Metropolitan">Kamrup Metropolitan (Guwahati)</option>
              <option value="Shimla">Shimla</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-on-surface">Password *</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a password"
              className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs border border-outline-variant/30 outline-none focus:border-primary"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-11 rounded-lg bg-primary text-on-primary font-bold text-xs hover:bg-primary-container transition-all shadow-xs disabled:opacity-60"
          >
            {loading ? 'Registering...' : 'Create Citizen Account'}
          </button>
        </form>

        <div className="text-center text-xs text-on-surface-variant pt-1">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-primary hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
};
