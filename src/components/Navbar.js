import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const { currentUser } = useAuth();

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <Link to="/">ReLink</Link>
      </div>
      <div className="nav-links">
        {currentUser ? (
          <>
            <Link to="/vault">Vault</Link>
            <Link to="/feed">Feed</Link>
            <Link to="/profile" className="profile-link">
              Profile
            </Link>
          </>
        ) : (
          <Link to="/">Login</Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar; 