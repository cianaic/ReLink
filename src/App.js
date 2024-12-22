import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Vault from './components/Vault';
import Feed from './components/Feed';
import Profile from './components/Profile';
import './App.css';

// Wrapper component to handle conditional navbar rendering
const AppContent = () => {
  const { currentUser } = useAuth();

  return (
    <div className="app">
      {currentUser && <Navbar />}
      <main className={currentUser ? "main-content" : "full-content"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/vault" element={<Vault />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
