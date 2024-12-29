import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getPublicProfile } from '../services/userService';
import { sendFriendRequest } from '../services/friendService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const InviteLanding = () => {
  const { userId } = useParams();
  const { signInWithGoogle, currentUser } = useAuth();
  const navigate = useNavigate();
  const [inviter, setInviter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      const userCredential = await signInWithGoogle();
      
      // Check if user already exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      const isExistingUser = userDoc.exists();

      // Send friend request automatically
      try {
        await sendFriendRequest(userCredential.user.uid, userId);
        
        if (isExistingUser) {
          // If existing user, go to feed with success message
          navigate('/feed', { 
            state: { 
              showNotification: true,
              notificationMessage: `Friend request sent to ${inviter?.displayName}`
            }
          });
        } else {
          // If new user, go to connect page with success message
          navigate(`/connect/${userId}`, { 
            state: { autoRequestSent: true }
          });
        }
      } catch (requestError) {
        console.error('Error sending friend request:', requestError);
        navigate('/feed');
      }
    } catch (error) {
      console.error('Error signing in:', error);
      setError('Failed to sign in with Google');
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
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <img 
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
              alt="Google logo" 
            />
            {loading ? 'Signing in...' : 'Continue with Google'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteLanding; 