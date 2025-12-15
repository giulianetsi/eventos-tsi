import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ element: Component, ...rest }) => {
  const { isAuthenticated, loading } = useAuth();

  console.log('Estado de autenticação no PrivateRoute:', isAuthenticated);
  console.log('Loading:', loading);

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return <div>Carregando...</div>;
  }

  // Renderizar o componente protegido se autenticado, caso contrário redirecionar para /login
  return isAuthenticated ? Component : <Navigate to="/login" replace />;
};

export default PrivateRoute;
