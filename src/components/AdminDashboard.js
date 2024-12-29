import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, doc, deleteDoc, query, where, updateDoc } from 'firebase/firestore';
import { ForceGraph2D } from 'react-force-graph';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getFriends } from '../services/friendService';
import '../styles/AdminDashboard.css';

const ADMIN_UID = 'VGKFRWqEzyQMor0Xg4qvAyEWivA3';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [friendships, setFriendships] = useState([]);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser?.uid !== ADMIN_UID) {
      navigate('/');
      return;
    }
    loadData();
  }, [currentUser, navigate]);

  // Clear messages after 3 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load users directly from Firestore
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);

      // Load posts
      const postsSnapshot = await getDocs(collection(db, 'relinks'));
      const postsData = postsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));
      setPosts(postsData);

      // Load friendships for network graph
      const friendshipData = await Promise.all(
        usersData.map(async user => {
          const friends = await getFriends(user.uid);
          return friends.map(friend => ({
            source: user.uid,
            target: friend.uid
          }));
        })
      );
      setFriendships(friendshipData.flat());

    } catch (err) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Prepare data for network graph
  const graphData = useMemo(() => {
    return {
      nodes: users.map(user => ({
        id: user.uid,
        name: user.displayName || user.email,
        val: posts.filter(post => post.userId === user.uid || post.authorId === user.uid).length
      })),
      links: friendships
    };
  }, [users, posts, friendships]);

  // Prepare data for user growth chart
  const growthData = useMemo(() => {
    const sortedUsers = [...users].sort((a, b) => 
      new Date(a.createdAt) - new Date(b.createdAt)
    );

    return sortedUsers.reduce((acc, user, index) => {
      const date = new Date(user.createdAt).toLocaleDateString();
      const existingPoint = acc.find(point => point.date === date);
      
      if (existingPoint) {
        existingPoint.users = index + 1;
      } else {
        acc.push({ date, users: index + 1 });
      }
      
      return acc;
    }, []);
  }, [users]);

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await deleteDoc(doc(db, 'relinks', postId));
      setPosts(posts.filter(post => post.id !== postId));
    } catch (err) {
      setError('Failed to delete post: ' + err.message);
    }
  };

  const handleResetUserPosts = async (userId) => {
    if (!window.confirm('Are you sure you want to reset all posts for this user?')) return;
    try {
      // Delete all posts for the user (check both userId and authorId)
      const userPosts = posts.filter(post => post.userId === userId || post.authorId === userId);
      await Promise.all(userPosts.map(post => 
        deleteDoc(doc(db, 'relinks', post.id))
      ));

      // Reset the user's currentWeekPost field
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        currentWeekPost: null
      });

      setPosts(posts.filter(post => post.userId !== userId && post.authorId !== userId));
      setSuccess('User posts reset successfully');
    } catch (err) {
      setError('Failed to reset user posts: ' + err.message);
    }
  };

  const filteredPosts = selectedUser 
    ? posts.filter(post => post.userId === selectedUser || post.authorId === selectedUser)
    : posts;

  const getUserPostCount = (userId) => {
    return posts.filter(post => post.userId === userId || post.authorId === userId).length;
  };

  if (currentUser?.uid !== ADMIN_UID) {
    return null;
  }

  if (loading) {
    return <div className="admin-dashboard">Loading...</div>;
  }

  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <section className="analytics-section">
        <div className="section-header">
          <h2>Analytics</h2>
        </div>
        <div className="analytics-grid">
          <div className="analytics-card">
            <h3>User Growth</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="users" stroke="#8884d8" name="Total Users" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="analytics-card">
            <h3>Friend Network</h3>
            <div className="graph-container">
              <ForceGraph2D
                graphData={graphData}
                nodeLabel="name"
                nodeRelSize={6}
                nodeAutoColorBy="name"
                linkDirectionalParticles={1}
                linkDirectionalParticleSpeed={0.01}
                width={600}
                height={400}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="users-section">
        <div className="section-header">
          <h2>Users ({users.length})</h2>
          <div className="user-filter">
            <select 
              value={selectedUser || ''} 
              onChange={(e) => setSelectedUser(e.target.value || null)}
              className="user-select"
            >
              <option value="">All Users</option>
              {users.map(user => (
                <option key={user.uid} value={user.uid}>
                  {user.displayName || user.email}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="users-grid">
          {users.map(user => (
            <div key={user.uid} className="user-card">
              <div className="user-card-header">
                <img src={user.photoURL || '/default-avatar.png'} alt={user.displayName} className="user-avatar" />
                <div className="user-info">
                  <h3>{user.displayName || user.email}</h3>
                  <p className="user-email">{user.email}</p>
                  <p className="user-meta">
                    Posts: {getUserPostCount(user.uid)}
                  </p>
                </div>
              </div>
              <div className="user-card-actions">
                <button 
                  onClick={() => handleResetUserPosts(user.uid)}
                  className="danger-button"
                >
                  Reset Posts
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="posts-section">
        <h2>Posts ({filteredPosts.length})</h2>
        <div className="posts-grid">
          {filteredPosts.map(post => {
            const author = users.find(user => user.uid === (post.authorId || post.userId));
            return (
              <div key={post.id} className="post-card">
                <div className="post-header">
                  <img 
                    src={post.authorPhotoURL || author?.photoURL || '/default-avatar.png'} 
                    alt={author?.displayName} 
                    className="post-avatar" 
                  />
                  <div className="post-author">
                    <span className="author-name">
                      {post.authorName || author?.displayName || author?.email || 'Unknown User'}
                    </span>
                    <span className="post-date">
                      {post.createdAt ? post.createdAt.toLocaleString() : 'Unknown date'}
                    </span>
                  </div>
                </div>
                <div className="post-content">
                  {post.comment && <p className="post-comment">{post.comment}</p>}
                  <div className="post-url">
                    <a href={post.url} target="_blank" rel="noopener noreferrer">{post.url}</a>
                  </div>
                </div>
                <div className="post-footer">
                  <button 
                    onClick={() => handleDeletePost(post.id)}
                    className="danger-button"
                  >
                    Delete Post
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
} 