import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const { currentUser } = useAuth();
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <Link to="/">ReLink</Link>
      </div>
      <div className="nav-links">
        {currentUser ? (
          <>
            <Link to="/vault" className={isActive('/vault')}>Vault</Link>
            <Link to="/feed" className={isActive('/feed')}>Feed</Link>
            <Link to="/profile" className={`profile-link ${isActive('/profile')}`}>
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