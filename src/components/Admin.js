import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { ADMIN_UID } from '../constants/auth';
import AdminDashboard from './AdminDashboard';

const Admin = () => {
  const { currentUser } = useAuth();

  if (!currentUser || currentUser.uid !== ADMIN_UID) {
    return <Navigate to="/" replace />;
  }

  return <AdminDashboard />;
};

export default Admin; 