import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { getFriends } from '../services/friendService';
import EditProfile from './EditProfile';
import feedService from '../services/feedService';

const Profile = () => {
  const { currentUser, userProfile, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [relinks, setRelinks] = useState([]);
  const [loadingRelinks, setLoadingRelinks] = useState(true);

  useEffect(() => {
    const loadFriends = async () => {
      if (currentUser) {
        try {
          const friendsData = await getFriends(currentUser.uid);
          setFriends(friendsData);
        } catch (error) {
          console.error('Error loading friends:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    const loadRelinks = async () => {
      if (currentUser) {
        try {
          setLoadingRelinks(true);
          const { posts } = await feedService.getFeedPosts(1, null, [currentUser.uid]);
          setRelinks(posts);
        } catch (error) {
          console.error('Error loading ReLinks:', error);
        } finally {
          setLoadingRelinks(false);
        }
      }
    };

    loadFriends();
    loadRelinks();
  }, [currentUser]);

  if (!currentUser) {
    return <Navigate to="/" />;
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const handleShareInvite = () => {
    const inviteLink = `${window.location.origin}/connect/${currentUser.uid}`;
    navigator.clipboard.writeText(inviteLink);
    // Could add a toast notification here
  };

  return (
    <>
      <div className="max-w-4xl mx-auto px-4">
        <div className="grid grid-cols-1 gap-8">
          {/* Profile Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                {userProfile?.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt={userProfile.displayName}
                    className="w-16 h-16 rounded-full"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-2xl font-medium text-gray-600">
                      {userProfile?.displayName?.[0] || currentUser.email?.[0]}
                    </span>
                  </div>
                )}
                <h2 className="text-2xl font-semibold text-gray-900">Profile</h2>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Log Out
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Email
                </label>
                <p className="text-gray-900">{currentUser.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Display Name
                </label>
                <p className="text-gray-900">{userProfile?.displayName || 'Not set'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Bio
                </label>
                <p className="text-gray-900">{userProfile?.bio || 'No bio yet'}</p>
              </div>

              <button
                onClick={() => setIsEditing(true)}
                className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
              >
                Edit Profile
              </button>
            </div>
          </div>

          {/* Friends Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Connect with Friends</h2>
            
            <button 
              onClick={handleShareInvite}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors mb-8"
            >
              Share Invite Link
            </button>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Your Friends ({friends.length})
              </h3>
              
              <div className="space-y-4">
                {loading ? (
                  <p className="text-gray-500">Loading friends...</p>
                ) : friends.length === 0 ? (
                  <p className="text-gray-500">No friends yet. Share your invite link to connect!</p>
                ) : (
                  friends.map((friend) => (
                    <div key={friend.uid} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      {friend.photoURL ? (
                        <img
                          src={friend.photoURL}
                          alt={friend.displayName}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-lg font-medium text-gray-600">
                            {friend.displayName?.[0] || friend.email?.[0]}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{friend.displayName || 'Anonymous'}</p>
                        {friend.email && (
                          <p className="text-sm text-gray-500">{friend.email}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Historic ReLinks Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Your ReLinks</h2>
            
            <div className="space-y-6">
              {loadingRelinks ? (
                <p className="text-gray-500">Loading ReLinks...</p>
              ) : relinks.length === 0 ? (
                <p className="text-gray-500">No ReLinks shared yet. Share your first monthly ReLink from your vault!</p>
              ) : (
                relinks.map((relink) => (
                  <div key={relink.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-medium text-gray-900">
                        {relink.monthName} {relink.year} ReLink
                      </h3>
                      <span className="text-sm text-gray-500">
                        {new Date(relink.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {relink.monthlyLinks && (
                      <div className="space-y-3">
                        {relink.monthlyLinks.map((link, index) => (
                          <div key={index} className="bg-gray-50 rounded p-3">
                            <a 
                              href={link.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="font-medium text-primary hover:text-primary-hover"
                            >
                              {link.title}
                            </a>
                            {link.comment && (
                              <p className="text-sm text-gray-600 mt-1">{link.comment}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {isEditing && (
        <EditProfile onClose={() => setIsEditing(false)} />
      )}
    </>
  );
};

export default Profile; 