import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { currentUser } = useAuth();

  return (
    <nav className="navbar">
      <Link to="/" className="logo">
        ReLink
      </Link>
      <div className="nav-profile">
        {currentUser && (
          <div className="nav-user-info">
            <img 
              src={currentUser.photoURL || '/default-avatar.png'} 
              alt="Profile" 
              className="nav-avatar"
            />
            <span>{currentUser.displayName || currentUser.email}</span>
          </div>
        )}
      </div>
      <div className="nav-links">
        <NavLink 
          to="/feed" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          Feed
        </NavLink>
        <NavLink 
          to="/vault" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          Vault
        </NavLink>
        <NavLink 
          to="/profile" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          Profile
        </NavLink>
      </div>
    </nav>
  );
} 