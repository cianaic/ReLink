import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { sendFriendRequest } from '../services/friendService';
import { getPublicProfile } from '../services/userService';

const Connect = () => {
  const { userId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    // Check if we have an auto-request state from signup
    if (location.state?.autoRequestSent) {
      setRequestSent(true);
    }
  }, [location.state]);

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setLoading(true);
        setError('');

        const profile = await getPublicProfile(userId);
        if (!profile) {
          setError('User not found');
          return;
        }

        setUserProfile({
          ...profile,
          uid: userId
        });
      } catch (error) {
        console.error('Error loading user profile:', error);
        setError('Failed to load user profile. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [userId]);

  // Auto-send friend request when user logs in
  useEffect(() => {
    const autoSendRequest = async () => {
      if (currentUser && userProfile && !requestSent && currentUser.uid !== userId) {
        try {
          setLoading(true);
          await sendFriendRequest(currentUser.uid, userId);
          setRequestSent(true);
        } catch (error) {
          console.error('Error auto-sending friend request:', error);
          setError('Failed to send friend request automatically.');
        } finally {
          setLoading(false);
        }
      }
    };

    autoSendRequest();
  }, [currentUser, userProfile, userId, requestSent]);

  const handleConnect = async () => {
    if (!currentUser) {
      // Redirect to invite landing page
      navigate(`/invite/${userId}`);
      return;
    }

    // Don't allow connecting to yourself
    if (currentUser.uid === userId) {
      setError("You can't send a friend request to yourself");
      return;
    }

    try {
      setLoading(true);
      setError('');
      await sendFriendRequest(currentUser.uid, userId);
      setRequestSent(true);
    } catch (error) {
      console.error('Error sending friend request:', error);
      setError('Failed to send friend request. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="connect-landing">
        <div className="connect-content">
          <div className="loading">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="connect-landing">
        <div className="connect-content">
          <div className="error-message">{error}</div>
          <button onClick={() => navigate('/')} className="connect-back-button">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.uid === userId;

  return (
    <div className="connect-landing">
      <nav className="connect-nav">
        <div className="nav-brand">
          <a href="/">ReLink</a>
        </div>
        {!currentUser && (
          <button onClick={() => navigate(`/invite/${userId}`)} className="nav-login-button">
            Get Started
          </button>
        )}
      </nav>

      <div className="connect-content">
        <div className="profile-preview">
          <img 
            src={userProfile?.photoURL || '/default-avatar.png'} 
            alt={userProfile?.displayName} 
            className="profile-photo"
          />
          <h1>{userProfile?.displayName}</h1>
          <p className="tagline">See {userProfile?.displayName}'s most interesting links weekly</p>
          {userProfile?.bio && (
            <p className="bio">{userProfile.bio}</p>
          )}
        </div>
        
        {requestSent ? (
          <div className="success-message">
            <h2>Link request sent!</h2>
            <p>You'll be notified when {userProfile?.displayName} accepts your request.</p>
            <button onClick={() => navigate('/')} className="connect-home-button">
              Go to Feed
            </button>
          </div>
        ) : (
          <div className="connect-actions">
            {isOwnProfile ? (
              <div className="own-profile-message">
                <p>This is your ReLink invite page. Share this link with friends to connect!</p>
                <button onClick={() => navigate('/profile')} className="view-profile-button">
                  View Your Profile
                </button>
              </div>
            ) : (
              <button 
                onClick={handleConnect} 
                className="connect-button"
                disabled={loading}
              >
                {loading ? 'Sending Request...' : `Link with ${userProfile?.displayName}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Connect; 