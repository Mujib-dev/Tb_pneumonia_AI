import { createContext, useContext, useEffect, useState } from 'react';
import api, {
  AUTH_SESSION_EXPIRED_EVENT,
  clearAuthSession,
  getStoredToken,
  getStoredUser,
  saveAuthSession,
  saveAuthUser,
} from './api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = getStoredToken();
    const storedUser = getStoredUser();
    if (storedToken && storedUser) {
      setUser(storedUser);
    } else if (storedToken || storedUser) {
      clearAuthSession();
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => setUser(null);
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  const login = async (identifier, password) => {
    const response = await api.post('/auth/login', { identifier, password });
    const { access_token: accessToken, ...userData } = response.data || {};
    const authenticatedUser = saveAuthSession(accessToken, userData);
    setUser(authenticatedUser);
    return authenticatedUser;
  };

  const logout = (redirectTo) => {
    const isPatientUser = user?.role === 'patient';
    clearAuthSession();
    setUser(null);
    if (redirectTo) {
      window.location.href = redirectTo;
    } else if (isPatientUser) {
      window.location.href = '/';
    }
  };

  const updateUser = (newUserData) => {
    if (!user) return;
    const updatedUser = saveAuthUser({ ...user, ...newUserData });
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
