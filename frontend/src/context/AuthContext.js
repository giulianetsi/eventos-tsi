import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const logoutTimerRef = useRef(null);

  useEffect(() => {
    // Verificar se o usuário já está autenticado ao carregar a página
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('user_id');
    
    if (token && userId) {
      console.log('Usuário já autenticado encontrado no localStorage');
      // Definir header Authorization para chamadas subsequentes (fallback quando cookie não for enviado)
      try { api.defaults.headers.common['Authorization'] = `Bearer ${token}`; } catch (e) { /* ignore */ }
      setIsAuthenticated(true);
      // configurar timer de logout baseado em exp do token
      try { scheduleAutoLogoutFromToken(token); } catch (e) { /* ignore */ }
    } else {
      console.log('Nenhuma autenticação encontrada no localStorage');
      setIsAuthenticated(false);
    }
    
    setLoading(false);
  }, []);

  // limpa timer de logout pendente
  const clearLogoutTimer = () => {
    try {
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
        logoutTimerRef.current = null;
      }
    } catch (e) {}
  };

  const scheduleAutoLogoutFromToken = (token) => {
    try {
      // JWT parse simples: header.payload.signature
      const parts = token.split('.');
      if (parts.length < 2) return;
      const raw = parts[1];
      const payloadJson = JSON.parse(decodeURIComponent(escape(window.atob(raw.replace(/-/g, '+').replace(/_/g, '/')))));
      const exp = payloadJson.exp; // exp em segundos
      if (!exp) return;
      const nowSec = Math.floor(Date.now() / 1000);
      const msUntilExp = (exp - nowSec) * 1000;
      if (msUntilExp <= 0) {
        // já expirado
        logout();
      } else {
        clearLogoutTimer();
        // programar logout 1s após expiração para garantir sincronização
        logoutTimerRef.current = setTimeout(() => {
          logout();
        }, msUntilExp + 1000);
      }
    } catch (e) {
      // não bloquear por erro de parsing
    }
  };

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

  const logout = async () => {
    // Notificar o servidor sobre o logout
    try {
      await api.post('/users/logout');
    } catch (e) {
      // Continuar mesmo se falhar
      console.log('Aviso: erro ao notificar servidor do logout', e?.message);
    }
    
    console.log('Usuário deslogado - limpando todos os dados de sessão');
    
    // Obter user_id antes de limpar para limpar decisão de notificação específica
    const userId = localStorage.getItem('user_id');
    
    // Limpar TODOS os dados do localStorage relacionados ao usuário
    localStorage.removeItem('authToken');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_type');
    localStorage.removeItem('user_first_name');
    localStorage.removeItem('user_last_name');
    localStorage.removeItem('permissions');
    
    // Limpar decisão de notificação específica do usuário
    if (userId) {
      localStorage.removeItem(`notificationDecision_${userId}`);
    }
    
    // Limpar também a decisão geral antiga (compatibilidade)
    localStorage.removeItem('notificationDecision');
    // Remover header Authorization do axios para evitar enviar token inválido
    try { delete api.defaults.headers.common['Authorization']; } catch (e) { /* ignore */ }
    
    console.log('localStorage completamente limpo por segurança');
    
    clearLogoutTimer();
    setIsAuthenticated(false);
    console.log('Estado de autenticação atualizado:', false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);