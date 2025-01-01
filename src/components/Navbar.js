import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ADMIN_UID } from '../constants/auth';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentUser } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const getAlternateMainLink = () => {
    // On mobile, show the opposite of current main page in top bar
    if (location.pathname === '/feed') {
      return (
        <Link
          to="/vault"
          className="text-gray-700 hover:text-gray-900 text-base font-medium px-3 py-2"
        >
          Vault
        </Link>
      );
    }
    if (location.pathname === '/vault') {
      return (
        <Link
          to="/feed"
          className="text-gray-700 hover:text-gray-900 text-base font-medium px-3 py-2"
        >
          Feed
        </Link>
      );
    }
    return null;
  };

  return (
    <nav className="bg-white shadow-sm fixed top-0 left-0 right-0 z-[60]">
      {/* Top bar container with higher z-index */}
      <div className="bg-white relative z-[70] shadow-sm">
        <div className="flex items-center justify-between h-12 px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xl font-bold text-gray-900">
              ReLink
            </Link>
          </div>

          {currentUser && (
            <div className="flex items-center gap-2">
              {/* Show alternate main link (Feed/Vault) on mobile */}
              <div className="md:hidden flex items-center">
                {getAlternateMainLink()}
              </div>

              {/* Menu button */}
              <button
                onClick={toggleMenu}
                className="md:hidden inline-flex items-center justify-center p-2 text-gray-700 hover:text-gray-900 rounded-lg"
                aria-label="Open menu"
              >
                <svg
                  className="h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {currentUser && (
        <div 
          className={`${
            isOpen ? 'block' : 'hidden'
          } md:hidden border-t border-gray-200 bg-white shadow-lg absolute w-full z-[65]`}
        >
          <div className="py-2">
            <Link
              to="/feed"
              className={`block px-4 py-2 text-base font-medium ${
                isActive('/feed')
                  ? 'text-primary bg-primary bg-opacity-10'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
              }`}
              onClick={() => setIsOpen(false)}
            >
              Feed
            </Link>
            <Link
              to="/vault"
              className={`block px-4 py-2 text-base font-medium ${
                isActive('/vault')
                  ? 'text-primary bg-primary bg-opacity-10'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
              }`}
              onClick={() => setIsOpen(false)}
            >
              Vault
            </Link>
            <Link
              to="/profile"
              className={`block px-4 py-2 text-base font-medium ${
                isActive('/profile')
                  ? 'text-primary bg-primary bg-opacity-10'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
              }`}
              onClick={() => setIsOpen(false)}
            >
              Profile
            </Link>
            {currentUser.uid === ADMIN_UID && (
              <Link
                to="/admin"
                className={`block px-4 py-2 text-base font-medium ${
                  isActive('/admin')
                    ? 'text-primary bg-primary bg-opacity-10'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
                onClick={() => setIsOpen(false)}
              >
                Admin
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      {currentUser && (
        <div className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:bg-white md:border-r md:pt-12 md:w-48 z-50">
          <div className="flex-1 flex flex-col pt-5 overflow-y-auto">
            <nav className="flex-1 px-2 space-y-1">
              <Link
                to="/feed"
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  isActive('/feed')
                    ? 'text-primary bg-primary bg-opacity-10'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Feed
              </Link>
              <Link
                to="/vault"
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  isActive('/vault')
                    ? 'text-primary bg-primary bg-opacity-10'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Vault
              </Link>
              <Link
                to="/profile"
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  isActive('/profile')
                    ? 'text-primary bg-primary bg-opacity-10'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Profile
              </Link>
              {currentUser.uid === ADMIN_UID && (
                <Link
                  to="/admin"
                  className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    isActive('/admin')
                      ? 'text-primary bg-primary bg-opacity-10'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Admin
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar; 