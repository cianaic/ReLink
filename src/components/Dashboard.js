import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch {
      console.error('Failed to log out');
    }
  }

  return (
    <div className="dashboard">
      <h2>Profile</h2>
      {currentUser ? (
        <div>
          <p>Email: {currentUser.email}</p>
          <button onClick={handleLogout}>Log Out</button>
        </div>
      ) : (
        <p>Please <button onClick={() => navigate('/login')}>log in</button></p>
      )}
    </div>
  );
} 