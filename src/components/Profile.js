import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { getFriends, getPendingRequests, acceptFriendRequest, rejectFriendRequest } from '../services/friendService';

export default function Profile() {
  const [error, setError] = useState('');
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showShareLink, setShowShareLink] = useState(false);
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    setError('');
    try {
      await logout();
      navigate('/login');
    } catch {
      setError('Failed to log out');
    }
  }

  useEffect(() => {
    const loadFriendsData = async () => {
      if (currentUser) {
        try {
          const [friendsData, requestsData] = await Promise.all([
            getFriends(currentUser.uid),
            getPendingRequests(currentUser.uid)
          ]);
          setFriends(friendsData);
          setPendingRequests(requestsData);
        } catch (error) {
          console.error('Error loading friends data:', error);
          setError('Failed to load friends data');
        }
      }
    };
    loadFriendsData();
  }, [currentUser]);

  const handleAcceptRequest = async (requesterId) => {
    try {
      await acceptFriendRequest(currentUser.uid, requesterId);
      const [friendsData, requestsData] = await Promise.all([
        getFriends(currentUser.uid),
        getPendingRequests(currentUser.uid)
      ]);
      setFriends(friendsData);
      setPendingRequests(requestsData);
    } catch (error) {
      console.error('Error accepting friend request:', error);
      setError('Failed to accept friend request');
    }
  };

  const handleRejectRequest = async (requesterId) => {
    try {
      await rejectFriendRequest(currentUser.uid, requesterId);
      const requestsData = await getPendingRequests(currentUser.uid);
      setPendingRequests(requestsData);
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      setError('Failed to reject friend request');
    }
  };

  const FriendsList = () => (
    <div className="friends-section">
      <h3>Connect with Friends</h3>
      <div className="share-profile">
        <button 
          className="share-profile-button"
          onClick={() => {
            const shareLink = `${window.location.origin}/connect/${currentUser.uid}`;
            navigator.clipboard.writeText(shareLink);
            setShowShareLink(true);
            setTimeout(() => setShowShareLink(false), 3000);
          }}
        >
          Share Invite Link
        </button>
        {showShareLink && (
          <div className="share-link-popup">Link copied to clipboard!</div>
        )}
      </div>
      
      {pendingRequests.length > 0 && (
        <div className="pending-requests">
          <h4>Pending Requests ({pendingRequests.length})</h4>
          {pendingRequests.map(request => (
            <div key={request.uid} className="request-item">
              <div className="request-user">
                <img src={request.photoURL || '/default-avatar.png'} alt={request.displayName} />
                <span>{request.displayName || 'Anonymous'}</span>
              </div>
              <div className="request-actions">
                <button 
                  onClick={() => handleAcceptRequest(request.uid)}
                  className="accept-button"
                >
                  Accept
                </button>
                <button 
                  onClick={() => handleRejectRequest(request.uid)}
                  className="reject-button"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="friends-list">
        <h4>Your Friends ({friends.length})</h4>
        {friends.length > 0 ? (
          friends.map(friend => (
            <div key={friend.uid} className="friend-item">
              <img src={friend.photoURL || '/default-avatar.png'} alt={friend.displayName} />
              <span>{friend.displayName || 'Anonymous'}</span>
            </div>
          ))
        ) : (
          <p className="no-friends">
            You haven't connected with any friends yet. Share your profile link to get started!
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="profile-container">
      <h2>Profile</h2>
      {error && <div className="error">{error}</div>}
      
      <div className="profile-info">
        <div className="profile-photo-container">
          {currentUser.photoURL ? (
            <img 
              src={`${currentUser.photoURL}?${new Date().getTime()}`} 
              alt="Profile" 
              className="profile-photo"
              onError={(e) => {
                console.error('Error loading profile image');
                e.target.src = '/default-avatar.png';
                setError('');
              }}
            />
          ) : (
            <div className="profile-photo-placeholder">
              {userProfile?.displayName?.[0] || currentUser.email[0]}
            </div>
          )}
          <div className="profile-actions">
            <Link to="/edit-profile" className="edit-profile-link">
              Edit Profile
            </Link>
            <Link to="/settings" className="settings-link">
              Settings
            </Link>
          </div>
        </div>

        <div className="profile-details">
          <div className="info-group">
            <label>Email</label>
            <p>{currentUser.email}</p>
          </div>
          <div className="info-group">
            <label>Display Name</label>
            <p>{userProfile?.displayName || 'Not set'}</p>
          </div>
          <div className="info-group">
            <label>Bio</label>
            <p>{userProfile?.bio || 'No bio yet'}</p>
          </div>
        </div>
      </div>

      <FriendsList />

      <button onClick={handleLogout} className="logout-button">
        Log Out
      </button>
    </div>
  );
} 