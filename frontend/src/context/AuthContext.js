import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const logoutTimerRef = useRef(null);

  // limpa timer de logout pendente
  const clearLogoutTimer = useCallback(() => {
    try {
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
        logoutTimerRef.current = null;
      }
    } catch (e) {}
  }, []);

  const logout = useCallback(async () => {
    // Obter a subscription e endpoint antes de fazer logout
    let endpoint = null;
    try {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          endpoint = subscription.endpoint;
          console.log('Endpoint obtido para remoção:', endpoint);
        }
      }
    } catch (e) {
      console.warn('Erro ao obter subscription para logout:', e?.message);
    }

    // Notificar o servidor sobre o logout (e remover subscription se houver endpoint)
    try {
      const body = endpoint ? { endpoint } : {};
      await api.post('/users/logout', body);
    } catch (e) {
      // Continuar mesmo se falhar
      console.log('Aviso: erro ao notificar servidor do logout', e?.message);
    }

    console.log('Usuário deslogado - limpando todos os dados de sessão');

    const userId = localStorage.getItem('user_id');

    localStorage.removeItem('authToken');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_type');
    localStorage.removeItem('user_first_name');
    localStorage.removeItem('user_last_name');
    localStorage.removeItem('permissions');

    if (userId) {
      localStorage.removeItem(`notificationDecision_${userId}`);
    }

    localStorage.removeItem('notificationDecision');
    try { delete api.defaults.headers.common['Authorization']; } catch (e) { /* ignore */ }

    console.log('localStorage completamente limpo por segurança');

    clearLogoutTimer();
    setIsAuthenticated(false);
    console.log('Estado de autenticação atualizado:', false);
  }, [clearLogoutTimer]);

  const scheduleAutoLogoutFromToken = useCallback((token) => {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return;
      const raw = parts[1];
      const payloadJson = JSON.parse(decodeURIComponent(escape(window.atob(raw.replace(/-/g, '+').replace(/_/g, '/')))));
      const exp = payloadJson.exp;
      if (!exp) return;
      const nowSec = Math.floor(Date.now() / 1000);
      const msUntilExp = (exp - nowSec) * 1000;
      if (msUntilExp <= 0) {
        logout();
      } else {
        clearLogoutTimer();
        logoutTimerRef.current = setTimeout(() => {
          logout();
        }, msUntilExp + 1000);
      }
    } catch (e) {
      // não bloquear por erro de parsing
    }
  }, [clearLogoutTimer, logout]);

  // login pode receber token opcional para configurar auto-logout
  const login = (token) => {
    console.log('Usuário autenticado');
    setIsAuthenticated(true);
    console.log('Estado de autenticação atualizado:', true);
    if (token) {
      try { api.defaults.headers.common['Authorization'] = `Bearer ${token}`; } catch (e) {}
      try { scheduleAutoLogoutFromToken(token); } catch (e) {}
    } else {
      const stored = localStorage.getItem('authToken');
      if (stored) scheduleAutoLogoutFromToken(stored);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('user_id');

    if (token && userId) {
      console.log('Usuário já autenticado encontrado no localStorage');
      try { api.defaults.headers.common['Authorization'] = `Bearer ${token}`; } catch (e) { /* ignore */ }
      setIsAuthenticated(true);
      try { scheduleAutoLogoutFromToken(token); } catch (e) { /* ignore */ }
    } else {
      console.log('Nenhuma autenticação encontrada no localStorage');
      setIsAuthenticated(false);
    }

    setLoading(false);
  }, [scheduleAutoLogoutFromToken]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);