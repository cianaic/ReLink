import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import feedService from '../services/feedService';

const Feed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisibleDoc, setLastVisibleDoc] = useState(null);
  const { currentUser } = useAuth();

  const loadPosts = async (pageNum = 1) => {
    try {
      setLoading(true);
      setError(null);

      const result = await feedService.getFeedPage(pageNum, lastVisibleDoc);
      const newPosts = result.posts;

      if (pageNum === 1) {
        setPosts(newPosts);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }

      setLastVisibleDoc(result.lastVisible);
      setHasMore(newPosts.length === 10);
      setPage(pageNum);
    } catch (err) {
      console.error('Error loading posts:', err);
      setError('Failed to load posts. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [currentUser]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadPosts(page + 1);
    }
  };

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="feed-container">
      <h2>Community Feed</h2>
      <div className="posts">
        {posts.map(post => (
          <div key={post.id} className="post-card">
            <div className="post-header">
              <span className="post-author">{post.authorName || 'Anonymous'}</span>
              <span className="post-date">
                {new Date(post.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="post-content">
              {post.links.map((link, index) => (
                <div key={index} className="post-link">
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.title || link.url}
                  </a>
                  {link.comment && <p className="link-comment">{link.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
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