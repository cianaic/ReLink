import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import feedService from '../services/feedService';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import ConfirmModal from './ConfirmModal';

const Feed = () => {
  const { currentUser } = useAuth();
  const [hasShared, setHasShared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [connections, setConnections] = useState([]);
  const [comments, setComments] = useState({});
  const [submittingComment, setSubmittingComment] = useState(null);
  const [deletingPost, setDeletingPost] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [likingPost, setLikingPost] = useState(null);

  useEffect(() => {
    const loadConnections = async () => {
      try {
        // Get connections where user is in the users array
        const connectionsRef = collection(db, 'connections');
        const q = query(connectionsRef, where('users', 'array-contains', currentUser.uid));
        const snapshot = await getDocs(q);
        
        // Get all other users from connections where current user is a member
        const connectedUsers = snapshot.docs.reduce((acc, doc) => {
          const users = doc.data().users || [];
          return [...acc, ...users.filter(uid => uid !== currentUser.uid)];
        }, []);

        // Remove duplicates
        const uniqueConnections = [...new Set(connectedUsers)];
        console.log('Loaded connections:', uniqueConnections);
        setConnections(uniqueConnections);
        return uniqueConnections;
      } catch (error) {
        console.error('Error loading connections:', error);
        return [];
      }
    };

    const checkSharedStatus = async () => {
      if (currentUser) {
        try {
          setLoading(true);
          const [shared, connectionsList] = await Promise.all([
            feedService.hasPostedThisMonth(currentUser.uid),
            loadConnections()
          ]);
          setHasShared(shared);
          if (shared) {
            console.log('Loading posts for users:', [currentUser.uid, ...connectionsList]);
            await loadPosts([currentUser.uid, ...connectionsList]);
          }
        } catch (error) {
          console.error('Error checking shared status:', error);
          setError('Failed to check sharing status');
        } finally {
          setLoading(false);
        }
      }
    };

    checkSharedStatus();
  }, [currentUser]);

  const loadPosts = async (userIds) => {
    try {
      setLoadingPosts(true);
      console.log('Getting feed posts for users:', userIds);
      const result = await feedService.getFeedPosts(1, null, userIds);
      console.log('Loaded posts:', result.posts);
      setPosts(result.posts);
    } catch (error) {
      console.error('Error loading posts:', error);
      setError('Failed to load feed posts');
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      setDeletingPost(postId);
      await feedService.deletePost(postId, currentUser.uid);
      setPosts(posts.filter(post => post.id !== postId));
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post. Please try again.');
    } finally {
      setDeletingPost(null);
    }
  };

  const handleLikePost = async (postId) => {
    try {
      setLikingPost(postId);
      const newLikeState = await feedService.toggleLike(postId, currentUser.uid);
      
      setPosts(posts.map(post => {
        if (post.id === postId) {
          const currentLikes = post.likes || [];
          return {
            ...post,
            likes: newLikeState 
              ? [...currentLikes, currentUser.uid]
              : currentLikes.filter(id => id !== currentUser.uid)
          };
        }
        return post;
      }));
    } catch (error) {
      console.error('Error liking post:', error);
    } finally {
      setLikingPost(null);
    }
  };

  const handleCommentSubmit = async (postId, comment) => {
    if (!comment.trim()) return;

    try {
      setSubmittingComment(postId);
      const postRef = doc(db, 'relinks', postId);
      const postDoc = await getDoc(postRef);
      
      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      const postComments = postDoc.data().comments || [];
      const newComment = {
        id: Date.now().toString(),
        text: comment.trim(),
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userPhotoURL: currentUser.photoURL,
        createdAt: new Date().toISOString()
      };

      await updateDoc(postRef, {
        comments: [...postComments, newComment]
      });

      setPosts(posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: [...(post.comments || []), newComment]
          };
        }
        return post;
      }));

      setComments({
        ...comments,
        [postId]: ''
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment. Please try again.');
    } finally {
      setSubmittingComment(null);
    }
  };

  const renderPost = (post) => (
    <div key={post.id} className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        {post.authorPhotoURL ? (
          <img src={post.authorPhotoURL} alt="" className="w-10 h-10 rounded-full" />
        ) : (
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-gray-600 font-medium">
              {post.authorName?.[0] || 'A'}
            </span>
          </div>
        )}
        <div className="flex-1">
          <p className="font-medium text-gray-900">{post.authorName}</p>
          <p className="text-sm text-gray-500">
            {new Date(post.createdAt).toLocaleDateString()}
          </p>
        </div>
        {post.type === 'monthly' && (
          <div className="text-right">
            <h3 className="text-lg font-semibold text-primary">
              {post.monthName} {post.year} ReLink
            </h3>
          </div>
        )}
        {post.userId === currentUser.uid && (
          <button
            onClick={() => setConfirmDelete(post.id)}
            disabled={deletingPost === post.id}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            title="Delete post"
          >
            {deletingPost === post.id ? (
              <span className="loading">...</span>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        )}
      </div>

      {post.type === 'monthly' && post.monthlyLinks ? (
        <div className="space-y-4">
          {post.monthlyLinks.map((link, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg">
              <a 
                href={link.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-medium text-blue-600 hover:underline"
              >
                {link.title}
              </a>
              {link.description && (
                <p className="mt-1 text-gray-600 text-sm">{link.description}</p>
              )}
              {link.comment && (
                <p className="mt-2 text-gray-700 italic">{link.comment}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 bg-gray-50 rounded-lg">
          <a 
            href={post.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-medium text-blue-600 hover:underline"
          >
            {post.title}
          </a>
          {post.description && (
            <p className="mt-1 text-gray-600 text-sm">{post.description}</p>
          )}
          {post.comment && (
            <p className="mt-2 text-gray-700 italic">{post.comment}</p>
          )}
        </div>
      )}

      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center mb-4">
          <button
            onClick={() => handleLikePost(post.id)}
            disabled={likingPost === post.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              (post.likes || []).includes(currentUser.uid)
                ? 'text-primary bg-primary bg-opacity-10'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
            title={
              (post.likes || []).includes(currentUser.uid) ? 'Unlike' : 'Like'
            }
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-5 w-5 ${likingPost === post.id ? 'animate-pulse' : ''}`}
              fill={(post.likes || []).includes(currentUser.uid) ? 'currentColor' : 'none'}
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            <span className="font-medium">
              {(post.likes || []).length || 'Like'}
            </span>
          </button>
        </div>

        {post.comments?.length > 0 && (
          <div className="mb-4 space-y-3">
            {post.comments.map(comment => (
              <div key={comment.id} className="flex items-start gap-3">
                {comment.userPhotoURL ? (
                  <img src={comment.userPhotoURL} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-gray-600 text-sm font-medium">
                      {comment.userName?.[0] || 'A'}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{comment.userName}</span>
                    {' '}
                    <span className="text-gray-500 text-xs">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                  </p>
                  <p className="text-gray-700">{comment.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={comments[post.id] || ''}
            onChange={(e) => setComments({
              ...comments,
              [post.id]: e.target.value
            })}
            placeholder="Add a comment..."
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleCommentSubmit(post.id, comments[post.id]);
              }
            }}
          />
          <button
            onClick={() => handleCommentSubmit(post.id, comments[post.id])}
            disabled={submittingComment === post.id || !comments[post.id]?.trim()}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {submittingComment === post.id ? 'Sending...' : 'Comment'}
          </button>
        </div>
      </div>
    </div>
  );

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!hasShared) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Feed Locked</h2>
          <p className="text-gray-600 mb-6">
            Share your top 5 links from your vault as your monthly ReLink to unlock the feed and see what your friends are sharing!
          </p>
          <Link
            to="/vault"
            className="inline-block px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            Go to Vault
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Feed</h1>
      {loadingPosts ? (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-600">Loading posts...</p>
        </div>
      ) : posts.length > 0 ? (
        <div className="space-y-6">
          {posts.map(renderPost)}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-600">No posts yet. Share your monthly ReLink to get started!</p>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => handleDeletePost(confirmDelete)}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
};

export default Feed; 