import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ADMIN_UID } from '../constants/auth';

const NavLink = ({ to, children, onClick, className = '' }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`
        px-4 py-3 rounded-lg transition-all w-full
        ${isActive 
          ? 'bg-blue-50 text-primary font-medium' 
          : 'text-gray-700 hover:bg-blue-50 hover:text-primary'
        }
        ${className}
      `}
    >
      {children}
    </Link>
  );
};

const Navbar = () => {
  const { currentUser } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 z-40">
        <Link 
          to="/" 
          className="text-2xl font-semibold text-gray-900"
          onClick={() => setIsMenuOpen(false)}
        >
          ReLink
        </Link>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden ml-auto p-2 text-gray-500 hover:text-gray-700 bg-white rounded-lg"
        >
          {isMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Navbar */}
      <nav className={`
        fixed top-16 md:top-0 left-0 h-[calc(100vh-4rem)] md:h-screen bg-white border-r border-gray-200 
        transition-all duration-300 ease-in-out z-30
        ${isMenuOpen ? 'w-64' : 'w-0 md:w-64'}
      `}>
        <div className="h-full p-6 overflow-y-auto">
          <div className="flex flex-col min-h-full">
            {/* Navigation Links */}
            <div className={`flex flex-col gap-2 md:pt-16 ${isMenuOpen ? 'opacity-100' : 'opacity-0 md:opacity-100'}`}>
              {currentUser ? (
                <>
                  <NavLink to="/vault" onClick={() => setIsMenuOpen(false)}>
                    Vault
                  </NavLink>
                  <NavLink to="/feed" onClick={() => setIsMenuOpen(false)}>
                    Feed
                  </NavLink>
                  <NavLink to="/profile" onClick={() => setIsMenuOpen(false)}>
                    Profile
                  </NavLink>
                  {currentUser.uid === ADMIN_UID && (
                    <NavLink 
                      to="/admin"
                      onClick={() => setIsMenuOpen(false)}
                      className="mt-auto bg-primary text-white hover:bg-primary-hover"
                    >
                      Admin
                    </NavLink>
                  )}
                </>
              ) : (
                <NavLink to="/" onClick={() => setIsMenuOpen(false)}>
                  Login
                </NavLink>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Overlay */}
      {isMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </>
  );
};

export default Navbar; 