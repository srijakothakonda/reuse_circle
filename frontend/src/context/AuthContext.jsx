import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/auth/me').then((r) => setUser(r.data.data.user)).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  const refresh = async () => { try { const { data } = await api.get('/auth/me'); setUser(data.data.user); return data.data.user; } catch { setUser(null); return null; } };
  const logout = async () => { await api.post('/auth/logout'); setUser(null); };
  return <AuthContext.Provider value={{ user, setUser, loading, refresh, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
