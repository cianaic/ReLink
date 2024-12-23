import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import feedService from '../services/feedService';
import { getFriends } from '../services/friendService';

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
  const { currentUser } = useAuth();

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
      const result = await feedService.getFeedPage(
        pageNum, 
        pageNum === 1 ? null : lastVisibleDoc, 
        userIds
      );

      // Process posts and preload images
      const processedPosts = result.posts.map(post => ({
        ...post,
        authorPhotoURL: post.authorPhotoURL || DEFAULT_AVATAR,
        authorDisplayName: post.authorId === currentUser.uid ? 'You' : (post.authorName || 'Anonymous')
      }));

      setPosts(prev => {
        const newPosts = pageNum === 1 ? processedPosts : [...prev, ...processedPosts];
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
    }
  }, [loadPosts, currentUser, userIds]);

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
  }, [loadPosts, currentUser]);

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
      <div className="posts">
        {posts.map(post => {
          const isOwnPost = post.authorId === currentUser?.uid;
          const authorDisplayName = isOwnPost ? 'You' : post.authorName || 'Anonymous';
          
          // Skip rendering posts without links
          if (!post.links || post.links.length === 0) {
            return null;
          }
          
          return (
            <div key={post.id} className="post-card">
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
                {Array.isArray(post.links) && post.links.map((link, index) => (
                  <div key={index} className="post-link">
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      {link.title || link.url}
                    </a>
                    {link.comment && <p className="link-comment">{link.comment}</p>}
                  </div>
                ))}
              </div>
              {isOwnPost && (
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
    </div>
  );
};

export default Feed; 