import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/ifsul-logo.svg';

// Ler a chave pública VAPID a partir da variável de ambiente em tempo de build
// para que os builds de produção possam injetar a chave real. Manter a chave
// existente apenas como fallback de desenvolvimento (será sobrescrita em produção).
const publicVapidKey = process.env.REACT_APP_PUBLIC_VAPID_KEY || 'BBOm7i70NnvHHfmL9e2KGu_xRm-Iwxh4PQLclLFkzYus4dO1w3iN_JxVnBSSV_shoDVaxuPWDkGAqIDR-iL2s8I';

const Login = () => {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' | 'error' | ''
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login: authenticate, isAuthenticated } = useAuth();

  // Redirecionar se já estiver autenticado
  useEffect(() => {
    if (isAuthenticated) {
      console.log('Usuário já autenticado, redirecionando...');
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    // limpar mensagens anteriores
    setMessage('');
    setMessageType('');
    setLoading(true);

    // validação 
    const loginTrimmed = (login || '').trim();
    const senhaValue = senha || '';
    if (!loginTrimmed || !senhaValue) {
      setMessage('Preencha todos os campos');
      setMessageType('error');
      return;
    }

    try {
      const response = await api.post('/users/login', { login: loginTrimmed, senha });
      console.log('Resposta do servidor:', response.data);
      console.log('Status da resposta:', response.status);

      // Verificar se o token de autenticação foi retornado
      const { token, user_id, user_type, user_first_name, user_last_name, permissions } = response.data;
      if (!token || !user_id) {
        throw new Error('Token ou Usuário ID não disponível');
      }

      // Armazenar o token e informações do usuário no localStorage
      localStorage.setItem('authToken', token);
      localStorage.setItem('user_id', user_id);
      localStorage.setItem('user_type', user_type);
      localStorage.setItem('user_first_name', user_first_name || '');
      localStorage.setItem('user_last_name', user_last_name || '');
      localStorage.setItem('permissions', JSON.stringify(permissions));

      // Atualizar o estado de autenticação
      // Definir header Authorization para chamadas subsequentes (fallback quando cookie não for enviado)
      try { api.defaults.headers.common['Authorization'] = `Bearer ${token}`; } catch (e) { /* ignore */ }
      // passar token para que o contexto agende logout automático pelo exp
      authenticate(token);

      // Tentar registrar para notificações push (não crítico)
      console.log('Iniciando processo de notificações push...');
      
      // Verificar se o usuário já decidiu sobre notificações antes (específico por usuário)
      const notificationDecisionKey = `notificationDecision_${user_id}`;
      const notificationDecision = localStorage.getItem(notificationDecisionKey);
      console.log('Decisão anterior sobre notificações para usuário', user_id, ':', notificationDecision);
      
      // Se já foi decidido (granted, denied, ou dismissed), não perguntar novamente
      if (notificationDecision && notificationDecision !== 'default') {
        console.log('Usuário já decidiu sobre notificações, pulando...');
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 100);
        return;
      }
      
      // Verificar se notificações são suportadas
      if (!('Notification' in window)) {
        console.log('Este navegador não suporta notificações');
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 100);
        return;
      }
      
      // Verificar se service worker é suportado
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications não suportadas neste navegador');
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 100);
        return;
      }

      try {
        console.log('Service Worker e PushManager disponíveis');
        
        // Primeiro registrar/aguardar service worker estar pronto
        let registration;
        try {
          registration = await navigator.serviceWorker.register('/service-worker.js');
          console.log('Service Worker registrado:', registration);
          
          // Aguardar que esteja realmente ativo
          await navigator.serviceWorker.ready;
          console.log('Service Worker pronto para uso');
        } catch (swError) {
          console.error('Erro ao registrar service worker:', swError);
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 100);
          return;
        }
        
        // Verificar permissão atual
        let permission = Notification.permission;
        console.log('Permissão atual para notificações:', permission);
        
        // Se ainda não foi solicitada, solicitar agora
        if (permission === 'default') {
          console.log('Solicitando permissão para notificações...');
          permission = await Notification.requestPermission();
          console.log('Nova permissão para notificações:', permission);
          
          // Salvar a decisão do usuário (específico por usuário)
          localStorage.setItem(notificationDecisionKey, permission);
        }
        
        if (permission === 'granted') {
          console.log('Permissão concedida, criando subscription...');
          
          // Verificar se já existe uma subscription
          let subscription = await registration.pushManager.getSubscription();
          console.log('Subscription existente:', subscription);
          
          if (!subscription) {
            console.log('Criando nova subscription...');
            try {
              subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
              });
              console.log('Nova subscription criada:', subscription);
            } catch (subscribeError) {
              console.error('Erro ao criar subscription:', subscribeError);
              // Continuar com login mesmo sem subscription
              setTimeout(() => {
                navigate('/', { replace: true });
              }, 100);
              return;
            }
          }

          if (subscription) {
            console.log('Enviando subscription para o servidor...');
            try {
              const p256dh = subscription.getKey('p256dh') ? btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))) : null;
              const auth = subscription.getKey('auth') ? btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth')))) : null;

              if (p256dh && auth) {
                await api.post('/users/subscribe', {
                  endpoint: subscription.endpoint,
                  keys: {
                    p256dh,
                    auth
                  },
                  user_id
                }, {
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });
                console.log('Notificações push configuradas com sucesso!');
              } else {
                console.error('Erro: Chaves da subscription não encontradas');
              }
            } catch (serverError) {
              console.error('Erro ao enviar subscription para servidor:', serverError);
              // Continuar mesmo com erro no servidor
            }
          }
        } else if (permission === 'denied') {
          console.log('Permissão para notificações negada pelo usuário');
        } else {
          console.log('Permissão para notificações não solicitada ainda');
        }
        
      } catch (pushError) {
        console.warn('Erro geral ao configurar notificações push:', pushError);
      }
      
      // Sempre continuar com o login
      console.log('Finalizando processo de push notifications...');

      // Redirecionar para a página inicial após login
      console.log('Login completo, redirecionando para a página inicial...');
      console.log('Estado de autenticação antes do redirect:', localStorage.getItem('authToken') ? 'autenticado' : 'não autenticado');
      
      // Pequeno delay para garantir que tudo foi salvo
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 100);
      
    } catch (error) {
      console.error('Erro completo:', error);
      console.error('Resposta do servidor:', error.response);
      if (error.response) {
        console.error('Status do erro:', error.response.status);
        console.error('Dados do erro:', error.response.data);
        if (error.response.status === 401) {
          // feedback claro ao usuário
          setMessage('Usuário ou senha inválidos');
          setMessageType('error');
        } else {
          setMessage(error.response.data.message || 'Erro no servidor');
          setMessageType('error');
        }
      } else if (error.request) {
        console.error('Erro de conexão:', error.request);
        setMessage('Erro de conexão com o servidor');
        setMessageType('error');
      } else {
        console.error('Erro desconhecido:', error.message);
        setMessage(error.message || 'Erro desconhecido');
        setMessageType('error');
      }
    } finally {
      setLoading(false);
    }
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
  // O hífen não precisa de escape fora de classes de caracteres — remover escape desnecessário
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  return (
    <div className="container centered-form login-page">
      <div className="row justify-content-center">
        <div className="col-12 col-sm-10 col-md-6 col-lg-4">
          <div className="text-center mb-4">
            <img src={logo} alt="IFSUL" className="login-logo" />
          </div>

          <div className="card login-card shadow-sm">
            <div className="card-body">
              {loading && <p>Carregando...</p>}
              <form onSubmit={handleLogin}>
                <div className="mb-3 username-field">
                  <label className="form-label login-label" htmlFor="username">Usuário</label>
                  <input
                    type="text"
                    id="username"
                    name="login"
                    className="form-control"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label login-label" htmlFor="password">Senha</label>
                  <div className="password-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="senha"
                      className="form-control"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      onClick={() => setShowPassword(s => !s)}
                    >
                      {showPassword ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                          <path d="M3 3L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M10.58 10.58a3 3 0 104.24 4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                          <path d="M1 12C1 12 5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="login-submit">
                  <button type="submit" className="btn btn-custom-primary">Acessar</button>
                </div>
              </form>
              {message && (
                <div className={`alert ${messageType === 'success' ? 'alert-success' : 'alert-danger'}`} role="alert" style={{ borderRadius: '8px', marginTop: '12px' }}>
                  <button type="button" className="btn-close" aria-label="Close" style={{ position: 'absolute', right: '8px', top: '8px' }} onClick={() => { setMessage(''); setMessageType(''); }}></button>
                  <div style={{ paddingRight: '28px' }}>{message}</div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;