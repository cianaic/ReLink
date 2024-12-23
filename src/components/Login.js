import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { sendFriendRequest } from '../services/friendService';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handlePendingInvite = async () => {
    const pendingInvite = sessionStorage.getItem('pendingInvite');
    if (pendingInvite) {
      try {
        await sendFriendRequest(currentUser.uid, pendingInvite);
        sessionStorage.removeItem('pendingInvite');
        navigate(`/connect/${pendingInvite}`);
      } catch (error) {
        console.error('Error sending friend request:', error);
      }
    } else {
      navigate('/profile');
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setError('');
      setLoading(true);
      await login(email, password);
      await handlePendingInvite();
    } catch {
      setError('Failed to sign in');
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    try {
      setError('');
      setLoading(true);
      console.log('Starting Google Sign In...');
      const result = await signInWithGoogle();
      console.log('Google Sign In Result:', result);
      await handlePendingInvite();
    } catch (error) {
      console.error('Google Sign In Error Details:', {
        code: error.code,
        message: error.message,
        fullError: error
      });
      setError(`Failed to sign in with Google: ${error.message}`);
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <h2>Log In</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button disabled={loading} type="submit">
          Log In
        </button>
      </form>
      
      <div className="divider">
        <span>or</span>
      </div>

      <button 
        className="google-button" 
        onClick={handleGoogleSignIn} 
        disabled={loading}
      >
        <img 
          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
          alt="Google logo" 
        />
        Sign in with Google
      </button>

      <div className="link-text">
        Need an account? <Link to="/signup">Sign Up</Link>
      </div>
    </div>
  );
}
