import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { sendFriendRequest } from '../services/friendService';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup, signInWithGoogle, currentUser } = useAuth();
  const navigate = useNavigate();

  const handlePendingInvite = async (user) => {
    const pendingInvite = sessionStorage.getItem('pendingInvite');
    if (pendingInvite) {
      try {
        await sendFriendRequest(user.uid, pendingInvite);
        sessionStorage.removeItem('pendingInvite');
        navigate(`/connect/${pendingInvite}`, { 
          state: { autoRequestSent: true }
        });
      } catch (error) {
        console.error('Error sending friend request:', error);
        navigate('/profile');
      }
    } else {
      navigate('/profile');
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();

    if (password !== passwordConfirm) {
      return setError('Passwords do not match');
    }

    try {
      setError('');
      setLoading(true);
      const userCredential = await signup(email, password);
      await handlePendingInvite(userCredential.user);
    } catch {
      setError('Failed to create an account');
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    try {
      setError('');
      setLoading(true);
      const userCredential = await signInWithGoogle();
      await handlePendingInvite(userCredential.user);
    } catch (error) {
      setError('Failed to sign in with Google');
      setLoading(false);
    }
  }

  return (
    <div className="signup-container">
      <h2>Sign Up</h2>
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
        <div className="form-group">
          <label>Password Confirmation</label>
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
          />
        </div>
        <button disabled={loading} type="submit">
          Sign Up
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
        Sign up with Google
      </button>
      <div className="link-text">
        Already have an account? <Link to="/login">Log In</Link>
      </div>
    </div>
  );
}