import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Home = () => {
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signInWithGoogle, currentUser } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  React.useEffect(() => {
    if (currentUser) {
      navigate('/vault');
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/vault');
    } catch (err) {
      setError('Failed to sign in. Please check your credentials.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      await signInWithGoogle();
      navigate('/vault');
    } catch (err) {
      setError('Failed to sign in with Google.');
      console.error('Google sign in error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="nav-brand">
          <Link to="/">ReLink</Link>
        </div>
        <button onClick={() => setShowLogin(true)} className="login-button">
          Login
        </button>
      </nav>

      <main className="landing-content">
        <h1>The Collective Knowledge Frontier</h1>
        <p className="landing-subtitle">
          Curate, share, and discover the best content from around the web with your community.
        </p>
        <button onClick={() => setShowLogin(true)} className="cta-button">
          Get Started
        </button>
      </main>

      {showLogin && (
        <div className="login-modal">
          <div className="login-modal-content">
            <button className="close-button" onClick={() => setShowLogin(false)}>×</button>
            <h2>Welcome to ReLink</h2>
            {error && <div className="error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={loading}>
                Sign In
              </button>
            </form>
            <div className="divider">
              <span>or</span>
            </div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="google-button"
            >
              <img src="/google-icon.svg" alt="Google" />
              Sign in with Google
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home; 