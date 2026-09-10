import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'CITIZEN' | 'DISTRICT_OFFICER' | 'FIELD_RESPONDER' | 'HEALTH_OFFICER' | 'STATE_EOC' | 'COMMUNITY_VOLUNTEER';
  district: string;
  state: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  registerCitizen: (data: { name: string; email: string; password: string; phone?: string; district?: string }) => Promise<User>;
  loginAsDemoRole: (role: User['role']) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('jeevangrid_token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const res = await apiFetch('/auth/me');
          setUser(res.user);
        } catch (e) {
          console.warn('Invalid token on startup, logging out:', e);
          localStorage.removeItem('jeevangrid_token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    }
    loadUser();
  }, [token]);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('jeevangrid_token', res.token);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const registerCitizen = async (data: { name: string; email: string; password: string; phone?: string; district?: string }): Promise<User> => {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    localStorage.setItem('jeevangrid_token', res.token);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const loginAsDemoRole = async (role: User['role']): Promise<User> => {
    const roleEmailMap: Record<User['role'], string> = {
      CITIZEN: 'citizen@demo.com',
      DISTRICT_OFFICER: 'district@demo.com',
      FIELD_RESPONDER: 'responder@demo.com',
      HEALTH_OFFICER: 'health@demo.com',
      STATE_EOC: 'state@demo.com',
      COMMUNITY_VOLUNTEER: 'volunteer@demo.com',
    };

    const email = roleEmailMap[role];
    return await login(email, 'Password123!');
  };

  const logout = () => {
    localStorage.removeItem('jeevangrid_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, registerCitizen, loginAsDemoRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
