import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import feedService from '../services/feedService';
import { getFriends } from '../services/friendService';
import { useLocation } from 'react-router-dom';
import { analytics } from '../firebase';
import { logEvent } from 'firebase/analytics';

// Default avatar as a constant to avoid repeated string literals
const DEFAULT_AVATAR = '/default-avatar.png';

const Feed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisibleDoc, setLastVisibleDoc] = useState(null);
  const [friends, setFriends] = useState([]);
  const [deletePostId, setDeletePostId] = useState(null);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const { currentUser } = useAuth();
  const location = useLocation();
  const [notification, setNotification] = useState(null);
  const [hasShared, setHasShared] = useState(false);

  // Get the invite link for the current user
  const inviteLink = useMemo(() => {
    if (!currentUser) return '';
    return `${window.location.origin}/connect/${currentUser.uid}`;
  }, [currentUser]);

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Memoize the friends IDs array to prevent unnecessary recalculations
  const friendIds = useMemo(() => {
    const ids = Array.isArray(friends) ? friends.map(friend => friend?.uid).filter(Boolean) : [];
    return ids;
  }, [friends]);

  // Always include current user's ID to see their own posts
  const userIds = useMemo(() => {
    if (!currentUser) return [];
    const ids = [currentUser.uid, ...friendIds];
    return ids;
  }, [currentUser, friendIds]);

  const loadPosts = useCallback(async (pageNum = 1) => {
    if (!currentUser) {
      setPosts([]);
      setHasMore(false);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      
      const result = await feedService.getFeedPage(
        pageNum, 
        pageNum === 1 ? null : lastVisibleDoc, 
        userIds
      );

      console.log('Feed received posts:', result.posts);
      setHasShared(result.hasShared);

      // Track feed view event
      logEvent(analytics, 'view_feed', {
        page_number: pageNum,
        posts_count: result.posts.length,
        has_shared: result.hasShared
      });

      // Process posts and preload images
      const processedPosts = result.posts
        .filter(post => post && post.links && Array.isArray(post.links))
        .map(post => ({
          ...post,
          authorPhotoURL: post.authorPhotoURL || DEFAULT_AVATAR,
          authorDisplayName: post.authorId === currentUser.uid ? 'You' : (post.authorName || 'Anonymous')
        }));

      console.log('Feed processed posts:', processedPosts);

      setPosts(prev => {
        const newPosts = pageNum === 1 ? processedPosts : [...prev, ...processedPosts];
        console.log('Feed updated posts:', newPosts);
        return newPosts;
      });
      
      setLastVisibleDoc(result.lastVisible);
      setHasMore(result.posts.length === 10);
      setPage(pageNum);

      // Preload images in the background
      processedPosts.forEach(post => {
        if (post.authorPhotoURL !== DEFAULT_AVATAR) {
          const img = new Image();
          img.src = post.authorPhotoURL;
          img.onerror = () => {
            // If image fails to load, update the post to use default avatar
            setPosts(prevPosts => 
              prevPosts.map(p => 
                p.id === post.id 
                  ? { ...p, authorPhotoURL: DEFAULT_AVATAR }
                  : p
              )
            );
          };
        }
      });
    } catch (err) {
      console.error('Error loading posts:', err);
      setError('Failed to load posts. Please try again later.');
      logEvent(analytics, 'feed_error', {
        error_type: err.code || 'unknown',
        error_message: err.message
      });
    } finally {
      setLoading(false);
    }
  }, [currentUser, userIds, lastVisibleDoc]);

  // Load friends only once when component mounts or user changes
  useEffect(() => {
    const loadFriendsData = async () => {
      if (currentUser) {
        console.log('Loading friends for user:', currentUser.uid);
        try {
          const friendsData = await getFriends(currentUser.uid);
          console.log('Loaded friends:', friendsData);
          setFriends(friendsData || []);
        } catch (error) {
          console.error('Error loading friends:', error);
          setFriends([]);
        }
      }
    };
    loadFriendsData();
  }, [currentUser]);

  // Load posts when userIds change or component mounts
  useEffect(() => {
    if (currentUser && userIds.length > 0) {
      console.log('Triggering initial post load');
      setLoading(true);
      loadPosts(1);
    } else {
      setLoading(false);
    }
  }, [currentUser, userIds]);

  // Add event listener for feed reload
  useEffect(() => {
    const handleReload = () => {
      console.log('Feed reload triggered');
      if (currentUser) {
        setLoading(true);
        setPage(1);
        setLastVisibleDoc(null);
        loadPosts(1);
      }
    };

    window.addEventListener('reloadFeed', handleReload);
    return () => window.removeEventListener('reloadFeed', handleReload);
  }, [currentUser]);

  useEffect(() => {
    if (location.state?.showNotification) {
      setNotification(location.state.notificationMessage);
      // Clear the notification after 3 seconds
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      console.log('Loading more posts, page:', page + 1);
      loadPosts(page + 1);
    }
  };

  const handleDeleteClick = (postId) => {
    setDeletePostId(postId);
  };

  const handleConfirmDelete = async () => {
    if (!currentUser || !deletePostId) return;
    
    try {
      setLoading(true);
      const noPostsRemain = await feedService.deletePost(deletePostId, currentUser.uid);
      setPosts(prevPosts => prevPosts.filter(post => post.id !== deletePostId));
      setDeletePostId(null);
      
      // If this was the last post for the week, dispatch an event to update the vault
      if (noPostsRemain) {
        window.dispatchEvent(new CustomEvent('weeklyPostDeleted'));
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      setError('Failed to delete post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setDeletePostId(null);
  };

  const handlePostClick = (post) => {
    logEvent(analytics, 'select_content', {
      content_type: 'post',
      item_id: post.id
    });
    // Add your post click handling logic here
  };

  console.log('Feed render state:', { 
    loading, 
    postsCount: posts.length, 
    error, 
    hasMore 
  });

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!currentUser) {
    return (
      <div className="feed-container">
        <div className="empty-feed">
          <h2>Please Sign In</h2>
          <p>Sign in to see your feed.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="feed-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!hasShared && currentUser) {
    return (
      <div className="feed-container">
        <div className="locked-feed">
          <h2>Your Feed is Locked</h2>
          <div className="lock-icon">🔒</div>
          <p>Share your weekly ReLinks to unlock your feed!</p>
          <p>See what your friends are sharing by contributing your own curated links.</p>
          <button 
            onClick={() => window.location.href = '/vault'} 
            className="share-to-unlock-button"
          >
            Share Your Links
          </button>
        </div>
      </div>
    );
  }

  if (!loading && (!posts || posts.length === 0)) {
    return (
      <div className="feed-container">
        <div className="empty-feed">
          <h2>Your Feed</h2>
          <p>No posts yet! Share some links from your vault to get started.</p>
          <p>Add friends to see their shared links here too.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="feed-container">
      <h2>Your Feed</h2>
      <div className="invite-section">
        <button onClick={handleCopyInvite} className="invite-button">
          ReLink with Friends
        </button>
        {showCopiedToast && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Success!</h3>
              <p>Invite link copied</p>
            </div>
          </div>
        )}
      </div>

      <div className="posts">
        {posts.map(post => {
          const isOwnPost = post.authorId === currentUser?.uid;
          const authorDisplayName = isOwnPost ? 'You' : post.authorName || 'Anonymous';
          
          // Skip rendering posts without links
          if (!post.links || post.links.length === 0) {
            return null;
          }
          
          return (
            <div key={post.id} className={`post-card ${post.isLocked ? 'locked' : ''}`}>
              <div className="post-header">
                <div className="post-author-info">
                  <img 
                    src={post.authorPhotoURL}
                    alt={authorDisplayName}
                    className="author-avatar"
                    loading="lazy"
                    onError={(e) => {
                      if (e.target.src !== DEFAULT_AVATAR) {
                        e.target.src = DEFAULT_AVATAR;
                      }
                    }}
                  />
                  <div className="post-author-details">
                    <span className="post-author">
                      {authorDisplayName}
                    </span>
                    <span className="post-date">
                      {post.dateStamp || (post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Unknown date')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="post-content">
                {post.isLocked ? (
                  <div className="locked-content">
                    <div className="lock-icon">🔒</div>
                    <p>Share your weekly ReLinks to unlock this post!</p>
                    <button 
                      onClick={() => window.location.href = '/vault'} 
                      className="share-to-unlock-button"
                    >
                      Share Your Links
                    </button>
                  </div>
                ) : (
                  Array.isArray(post.links) && post.links.map((link, index) => (
                    <div key={index} className="post-link">
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        {link.title || link.url}
                      </a>
                      {link.comment && <p className="link-comment">{link.comment}</p>}
                    </div>
                  ))
                )}
              </div>
              {isOwnPost && !post.isLocked && (
                <button
                  onClick={() => handleDeleteClick(post.id)}
                  className="post-menu-button"
                  title="Post options"
                >
                  ⋮
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {deletePostId && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Delete Post</h3>
            <p>Are you sure you want to delete this post?</p>
            <div className="modal-actions">
              <button onClick={handleCancelDelete} className="cancel-button">
                Cancel
              </button>
              <button onClick={handleConfirmDelete} className="delete-button">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="loading">Loading...</div>}
      {!loading && hasMore && (
        <button onClick={handleLoadMore} className="load-more-btn">
          Load More
        </button>
      )}

      {notification && (
        <div className="share-success-popup">
          <div className="share-success-content">
            <span className="success-icon">✓</span>
            {notification}
          </div>
        </div>
      )}
    </div>
  );
};

export default Feed; 