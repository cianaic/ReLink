import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MyFeed from './components/MyFeed';
import CurateFeed from './components/CurateFeed';
import SignUp from './components/SignUp';
import Login from './components/Login';
import './index.css';

// Define the Home component
const Home = () => {
  const { currentUser } = useAuth();
  
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-4">Welcome to Curate</h1>
      {currentUser ? (
        <div>
          <p>You're logged in. Check out your feeds!</p>
          <div className="mt-4 space-y-2">
            <Link to="/my-feed" className="block text-blue-500 hover:text-blue-700">Go to My Feed</Link>
            <Link to="/curate-feed" className="block text-blue-500 hover:text-blue-700">Go to Curate Feed</Link>
          </div>
        </div>
      ) : (
        <p>Share and discover 5 interesting links every month with your friends. Please log in or sign up to get started.</p>
      )}
    </div>
  );
};

// PrivateRoute component to protect routes that require authentication
const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
};

function AppContent() {
  const { currentUser, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-md p-4">
        <ul className="flex space-x-4 items-center">
          <li><Link to="/" className="text-blue-500 hover:text-blue-700">Home</Link></li>
          {currentUser ? (
            <>
              <li><Link to="/my-feed" className="text-blue-500 hover:text-blue-700">My Feed</Link></li>
              <li><Link to="/curate-feed" className="text-blue-500 hover:text-blue-700">Curate Feed</Link></li>
              <li><button onClick={handleLogout} className="text-red-500 hover:text-red-700">Logout</button></li>
              <li className="ml-auto"><span className="text-green-500">Logged in as: {currentUser.email}</span></li>
            </>
          ) : (
            <>
              <li><Link to="/signup" className="text-blue-500 hover:text-blue-700">Sign Up</Link></li>
              <li><Link to="/login" className="text-blue-500 hover:text-blue-700">Login</Link></li>
            </>
          )}
        </ul>
      </nav>
      <div className="container mx-auto mt-8 p-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/login" element={<Login />} />
          <Route path="/my-feed" element={<PrivateRoute><MyFeed /></PrivateRoute>} />
          <Route path="/curate-feed" element={<PrivateRoute><CurateFeed /></PrivateRoute>} />
        </Routes>
      </div>
    </div>
  );
}

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
