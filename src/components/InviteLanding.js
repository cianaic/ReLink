import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getPublicProfile } from '../services/userService';
import { sendFriendRequest } from '../services/friendService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getAuth, fetchSignInMethodsForEmail } from 'firebase/auth';

const InviteLanding = () => {
  const { userId } = useParams();
  const { signInWithGoogle, currentUser } = useAuth();
  const navigate = useNavigate();
  const [inviter, setInviter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    const loadInviterProfile = async () => {
      try {
        setLoading(true);
        const profile = await getPublicProfile(userId);
        if (!profile) {
          setError('Invite link not found');
          return;
        }
        setInviter(profile);
      } catch (error) {
        console.error('Error loading inviter profile:', error);
        setError('Failed to load invite information');
      } finally {
        setLoading(false);
      }
    };

    loadInviterProfile();
  }, [userId]);

  const handleQuickConnect = async () => {
    try {
      setLoading(true);
      const userCredential = await signInWithGoogle();
      await sendFriendRequest(userCredential.user.uid, userId);
      navigate('/feed', { 
        state: { 
          showNotification: true,
          notificationMessage: `Friend request sent to ${inviter?.displayName}`
        }
      });
    } catch (error) {
      console.error('Error with quick connect:', error);
      setError('Failed to connect. Please try again.');
      setLoading(false);
    }
  };

  const handleNewSignUp = async () => {
    try {
      setLoading(true);
      const userCredential = await signInWithGoogle();
      await sendFriendRequest(userCredential.user.uid, userId);
      navigate(`/connect/${userId}`, { 
        state: { autoRequestSent: true }
      });
    } catch (error) {
      console.error('Error signing up:', error);
      setError('Failed to sign up. Please try again.');
      setLoading(false);
    }
  };

  // If user is already logged in, send friend request and redirect
  useEffect(() => {
    const handleExistingUser = async () => {
      if (currentUser) {
        try {
          await sendFriendRequest(currentUser.uid, userId);
          navigate('/feed', { 
            state: { 
              showNotification: true,
              notificationMessage: `Friend request sent to ${inviter?.displayName}`
            }
          });
        } catch (error) {
          console.error('Error sending friend request:', error);
          navigate('/feed');
        }
      }
    };

    handleExistingUser();
  }, [currentUser, userId, inviter, navigate]);

  if (loading) {
    return (
      <div className="invite-landing">
        <div className="invite-content">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="invite-landing">
        <div className="invite-content">
          <div className="error-message">{error}</div>
          <button onClick={() => navigate('/')} className="back-button">
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="invite-landing">
      <nav className="invite-nav">
        <div className="nav-brand">ReLink</div>
      </nav>

      <div className="invite-content">
        <div className="invite-header">
          <img 
            src={inviter?.photoURL || '/default-avatar.png'} 
            alt={inviter?.displayName} 
            className="inviter-photo"
          />
          <h1>{inviter?.displayName} invited you to ReLink</h1>
          <p className="tagline">Join {inviter?.displayName} in sharing your most interesting links weekly</p>
        </div>

        <div className="invite-actions">
          <button 
            className="google-signin-button" 
            onClick={handleNewSignUp}
            disabled={loading}
          >
            <img 
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
              alt="Google logo" 
            />
            {loading ? 'Signing in...' : 'Sign up with Google'}
          </button>
          <div className="divider">
            <span>Already have an account?</span>
          </div>
          <button 
            className="quick-connect-button" 
            onClick={handleQuickConnect}
            disabled={loading}
          >
            Quick Connect
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteLanding; 