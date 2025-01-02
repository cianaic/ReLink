import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getPublicProfile } from '../services/userService';
import { getFriends, sendFriendRequest, checkFriendshipStatus } from '../services/friendService';
import feedService from '../services/feedService';

const PublicProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [relinks, setRelinks] = useState([]);
  const [loadingRelinks, setLoadingRelinks] = useState(true);
  const [friendshipStatus, setFriendshipStatus] = useState(null);
  const [sendingRequest, setSendingRequest] = useState(false);

  useEffect(() => {
    if (userId === currentUser?.uid) {
      navigate('/profile');
      return;
    }

    const loadProfile = async () => {
      try {
        const profileData = await getPublicProfile(userId);
        if (!profileData) {
          navigate('/');
          return;
        }
        setProfile(profileData);

        // Check friendship status
        const status = await checkFriendshipStatus(currentUser.uid, userId);
        setFriendshipStatus(status);

        // Load ReLinks if they are friends
        if (status === 'friends') {
          const { posts } = await feedService.getFeedPosts(1, null, [userId]);
          setRelinks(posts);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
        setLoadingRelinks(false);
      }
    };

    loadProfile();
  }, [userId, currentUser, navigate]);

  const handleSendFriendRequest = async () => {
    try {
      setSendingRequest(true);
      await sendFriendRequest(currentUser.uid, userId);
      setFriendshipStatus('pending');
    } catch (error) {
      console.error('Error sending friend request:', error);
    } finally {
      setSendingRequest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="grid grid-cols-1 gap-8">
        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-4 mb-6">
            {profile?.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.displayName}
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-2xl font-medium text-gray-600">
                  {profile?.displayName?.[0]}
                </span>
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-gray-900">{profile.displayName}</h2>
              {profile.bio && (
                <p className="text-gray-600 mt-1">{profile.bio}</p>
              )}
            </div>
            {friendshipStatus !== 'friends' && friendshipStatus !== 'pending' && (
              <button
                onClick={handleSendFriendRequest}
                disabled={sendingRequest}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {sendingRequest ? 'Sending...' : 'Add Friend'}
              </button>
            )}
            {friendshipStatus === 'pending' && (
              <span className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg">
                Request Sent
              </span>
            )}
          </div>

          {/* ReLinks Activity Grid */}
          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-900 mb-2">ReLink Activity</h3>
            <div className="flex flex-col gap-1">
              <div className="flex items-center text-xs text-gray-500 mb-1">
                <span className="w-16">2025</span>
                <div className="grid grid-cols-12 gap-1 flex-1">
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month) => (
                    <span key={month} className="text-center">{month}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center">
                <span className="w-16"></span>
                <div className="grid grid-cols-12 gap-1 flex-1">
                  {Array.from({ length: 12 }, (_, monthIndex) => {
                    const date = new Date(2025, monthIndex);
                    const hasRelink = relinks.some(relink => {
                      const relinkDate = new Date(relink.createdAt);
                      return relinkDate.getFullYear() === date.getFullYear() && 
                             relinkDate.getMonth() === date.getMonth();
                    });
                    
                    return (
                      <div
                        key={monthIndex}
                        className={`aspect-square w-full rounded-sm ${
                          hasRelink ? 'bg-primary' : 'bg-gray-100'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ReLinks Section (only visible to friends) */}
          {friendshipStatus === 'friends' && (
            <div className="mt-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recent ReLinks</h3>
              <div className="space-y-6">
                {loadingRelinks ? (
                  <p className="text-gray-500">Loading ReLinks...</p>
                ) : relinks.length === 0 ? (
                  <p className="text-gray-500">No ReLinks shared yet.</p>
                ) : (
                  relinks.map((relink) => (
                    <div key={relink.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-lg font-medium text-gray-900">
                          {relink.monthName} {relink.year} ReLink
                        </h4>
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
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicProfile; 