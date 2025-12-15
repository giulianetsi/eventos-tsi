// App.js
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import EventForm from './components/EventForm';
import Dashboard from './components/Dashboard';
import ManageGroups from './components/ManageGroups'; 
import GroupMembers from './components/GroupMembers';
import ManagePermissions from './components/ManagePermissions';
import UserProfile from './components/UserProfile';
import './App.css';
import TopNav from './components/TopNav';
import { useLocation } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute';
import { AuthProvider } from './context/AuthContext';

// Função para obter dados do usuário logado (escopo de módulo para ser reutilizável)
const getUserData = () => {
  const userTypeId = localStorage.getItem('user_type_id');
  const userType = localStorage.getItem('user_type');
  const firstName = localStorage.getItem('user_first_name');
  const lastName = localStorage.getItem('user_last_name');
  const permissions = localStorage.getItem('permissions');
  
  let username = 'Usuário';
  let isAdmin = false;
  
      if (permissions) {
    try {
      const perms = JSON.parse(permissions);
      // Considerar o usuário como administrador na UI se tiver permissões amplas de gestão.
      // Preferir campos explícitos (canCreateUser / canViewAllEvents) ao invés de depender somente de IDs numéricos.
      isAdmin = Boolean(perms.canCreateUser || perms.can_create_user || perms.canViewAllEvents || perms.can_view_all_events);
    } catch (e) {
      console.log('Erro ao parsear permissões:', e);
    }
  }
  
  // Preferir usar o nome real do usuário se disponível
  if (firstName) {
    username = `${firstName}${lastName ? ` ${lastName}` : ''}`;
  } else {
  // Fallback para tipo de usuário se nome não disponível
  // Preferir mapeamento numérico de user_type_id se disponível
    if (userTypeId) {
      switch(Number(userTypeId)) {
        case 1:
          username = 'Administrador';
          break;
        case 2:
          username = 'Professor';
          break;
        case 3:
          username = 'Estudante';
          break;
        case 4:
          username = 'Responsável';
          break;
        default:
          username = 'Usuário';
      }
      // Fallback numérico: se mapeado, tratar 1 como administrador
      if (Number(userTypeId) === 1) isAdmin = true;
    } else {
      switch(userType) {
        case 'admin':
          username = 'Administrador';
          break;
        case 'teacher':
          username = 'Professor';
          break;
        case 'student':
          username = 'Estudante';
          break;
        case 'guardian':
          username = 'Responsável';
          break;
        default:
          username = 'Usuário';
      }
      // Se user_type textual indicar 'admin', também marcar isAdmin
      if (userType === 'admin') isAdmin = true;
    }
  }
  
  return { username, isAdmin };
};

function App() {

  useEffect(() => {
    console.log('App carregado - Service Worker será registrado durante o login');
  }, []);

  return (
    <AuthProvider>
      <Router>
        <AppInner />
      </Router>
    </AuthProvider>
  );
}

function AppInner() {
  const location = useLocation();
  const showTopNav = location.pathname !== '/login';
  return (
    <div className="App">
      {/* Estilos utilitários injetados no nível do App para manter padrões visuais comuns */}
      <style>{`
        /* Força tamanho e cantos iguais ao botão primário, mantendo a variante de cor (ex: secondary) */
        .app-btn--primary-shape {
          border-radius: 25px;
          padding: 12px 30px;
          font-weight: 700;
          box-shadow: 0 6px 18px rgba(0,0,0,0.06);
          min-width: 160px;
          width: 160px;
        }
        @media (max-width: 576px) {
          .app-btn--primary-shape { width: 100%; min-width: 0; }
        }
      `}</style>
      {showTopNav && <TopNav />}
      <Routes>
            <Route path="/login" element={<Login />} />
            <Route 
              path="/register-user" 
              element={<PrivateRoute element={<Register />} />} 
            />
            <Route 
              path="/add-event" 
              element={<PrivateRoute element={<EventForm />} />} 
            />
            <Route 
              path="/gerenciar-grupos" 
              element={<PrivateRoute element={<ManageGroups />} />} 
            />
            <Route
              path="/gerenciar-grupos/:groupId/membros"
              element={<PrivateRoute element={<GroupMembers />} />}
            />
            <Route 
              path="/manage-permissions" 
              element={<PrivateRoute element={<ManagePermissions />} />} 
            />
            <Route 
              path="/profile"
              element={<PrivateRoute element={<UserProfile />} />}
            />
            <Route 
              path="/" 
              element={<PrivateRoute element={(() => {
                const userData = getUserData();
                return <Dashboard username={userData.username} isAdmin={userData.isAdmin} />;
              })()} />} 
            />
            {/* Rota fallback para qualquer URL não encontrada */}
            <Route 
              path="*" 
              element={<PrivateRoute element={(() => {
                const userData = getUserData();
                return <Dashboard username={userData.username} isAdmin={userData.isAdmin} />;
              })()} />} 
            />
          </Routes>
      </div>
  );
}

export default App;
