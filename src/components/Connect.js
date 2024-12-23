import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { sendFriendRequest } from '../services/friendService';

const Connect = () => {
  const { userId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setLoading(true);
        setError('');

        // Redirect to profile if trying to connect with self
        if (!currentUser) {
          navigate('/login');
          return;
        }

        if (userId === currentUser.uid) {
          navigate('/profile');
          return;
        }

        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
          setError('User not found');
          return;
        }

        const userData = userDoc.data();
        setUserProfile({
          ...userData,
          uid: userId,
          displayName: userData.displayName || 'Anonymous User'
        });
      } catch (error) {
        console.error('Error loading user profile:', error);
        setError('Failed to load user profile. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [userId, currentUser, navigate]);

  const handleConnect = async () => {
    try {
      if (!currentUser) {
        navigate('/login');
        return;
      }

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

  if (!currentUser) {
    return (
      <div className="connect-container">
        <div className="connect-card">
          <h2>Please Log In</h2>
          <p>You need to be logged in to connect with other users.</p>
          <button onClick={() => navigate('/login')} className="connect-button">
            Log In
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="connect-container">
        <div className="connect-card">
          <div className="loading">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="connect-container">
        <div className="connect-card">
          <div className="error-message">{error}</div>
          <button onClick={() => navigate('/')} className="back-button">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="connect-container">
      <div className="connect-card">
        <div className="profile-preview">
          <img 
            src={userProfile?.photoURL || '/default-avatar.png'} 
            alt={userProfile?.displayName} 
            className="profile-photo"
          />
          <h2>Link with {userProfile?.displayName}</h2>
          {userProfile?.bio && (
            <p className="bio">{userProfile.bio}</p>
          )}
        </div>
        
        {requestSent ? (
          <div className="success-message">
            <p>Friend request sent!</p>
            <button onClick={() => navigate('/')} className="home-button">
              Go to Feed
            </button>
          </div>
        ) : (
          <div className="connect-actions">
            <button 
              onClick={handleConnect} 
              className="connect-button"
              disabled={loading}
            >
              {loading ? 'Sending Request...' : 'Send Friend Request'}
            </button>
            <button 
              onClick={() => navigate('/')} 
              className="cancel-button"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Connect; 