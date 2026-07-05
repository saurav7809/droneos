import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthUser { username: string; token: string; }
interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('drone_user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = (username: string, token: string) => {
    const u = { username, token };
    setUser(u);
    localStorage.setItem('drone_user', JSON.stringify(u));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('drone_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
