import React from 'react';
import Navbar from './Navbar';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="relative">
        <main className="md:ml-64 min-h-[calc(100vh-4rem)] transition-all duration-400 ease-smooth">
          <div className="p-4 sm:p-6 md:p-8 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout; 