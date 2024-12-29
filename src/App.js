import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Vault from './components/Vault';
import Feed from './components/Feed';
import Profile from './components/Profile';
import Connect from './components/Connect';
import Settings from './components/Settings';
import EditProfile from './components/EditProfile';
import InviteLanding from './components/InviteLanding';
import AdminDashboard from './components/AdminDashboard';
import PrivateRoute from './components/PrivateRoute';
import './App.css';

// Configure future flags for React Router v7
const router = {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true
  }
};

// Wrapper component to handle conditional navbar rendering
const AppContent = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const isConnectPage = location.pathname.startsWith('/connect/');
  const isInvitePage = location.pathname.startsWith('/invite/');

  return (
    <div className="app">
      {currentUser && !isConnectPage && !isInvitePage && <Navbar />}
      <main className={currentUser && !isConnectPage && !isInvitePage ? "main-content" : "full-content"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/vault" element={<Vault />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/edit-profile" element={<EditProfile />} />
          <Route path="/connect/:userId" element={<Connect />} />
          <Route path="/invite/:userId" element={<InviteLanding />} />
          <Route path="/admin" element={
            <PrivateRoute>
              <AdminDashboard />
            </PrivateRoute>
          } />
        </Routes>
      </main>
    </div>
  );
};

function App() {
  return (
    <Router {...router}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
