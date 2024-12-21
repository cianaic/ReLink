import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { updateUserProfile, uploadProfilePicture, deleteUserProfile, logActivity } from '../utils/database';
import ActivityHistory from './ActivityHistory';

export default function Profile() {
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef();
  const { currentUser, userProfile, logout, refreshUserProfile } = useAuth();
  const navigate = useNavigate();

  console.log('Current User:', currentUser);
  console.log('User Profile:', userProfile);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setBio(userProfile.bio || '');
    }
  }, [userProfile]);

  async function handleLogout() {
    setError('');
    try {
      await logout();
      navigate('/login');
    } catch {
      setError('Failed to log out');
    }
  }

  async function handleProfileUpdate() {
    console.log('Updating profile...');
    try {
      setLoading(true);
      const updates = {};
      
      if (displayName || userProfile?.displayName) {
        updates.displayName = displayName || userProfile?.displayName;
      }
      
      if (bio || userProfile?.bio) {
        updates.bio = bio || userProfile?.bio;
      }

      console.log('Update data:', updates);
      
      if (Object.keys(updates).length > 0) {
        await updateUserProfile(currentUser.uid, updates);
        await logActivity(currentUser.uid, 'profile_update', 'Updated profile information');
        await refreshUserProfile();
        setIsEditing(false);
        console.log('Profile updated successfully');
      } else {
        console.log('No changes to update');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  }

  async function handlePictureUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      setError(''); // Clear any existing errors
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB');
        return;
      }

      console.log('Starting upload of file:', file.name);
      await uploadProfilePicture(currentUser.uid, file);
      console.log('Upload successful');
      
      await logActivity(currentUser.uid, 'profile_picture_update', 'Updated profile picture');
      await refreshUserProfile();
      
      // Force a refresh of the profile photo
      const img = document.querySelector('.profile-photo');
      if (img) {
        img.src = img.src.split('?')[0] + '?' + new Date().getTime();
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Failed to upload profile picture');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAccount() {
    try {
      setLoading(true);
      await deleteUserProfile(currentUser.uid);
      await currentUser.delete();
      navigate('/signup');
    } catch (error) {
      setError('Failed to delete account');
    } finally {
      setLoading(false);
    }
  }

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
                e.target.src = ''; // Clear the broken image
                setError('Failed to load profile picture');
              }}
            />
          ) : (
            <div className="profile-photo-placeholder">
              {userProfile?.displayName?.[0] || currentUser.email[0]}
            </div>
          )}
          <button 
            onClick={() => fileInputRef.current.click()} 
            className="change-photo-button"
            disabled={loading}
          >
            {loading ? 'Uploading...' : 'Change Photo'}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePictureUpload}
            accept="image/*"
            style={{ display: 'none' }}
          />
        </div>

        <div className="info-group">
          <label>Email</label>
          <p>{currentUser.email}</p>
        </div>
        
        {isEditing ? (
          <>
            <div className="info-group">
              <label>Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={userProfile?.displayName || 'Enter your name'}
              />
            </div>
            <div className="info-group">
              <label>Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={userProfile?.bio || 'Tell us about yourself'}
              />
            </div>
          </>
        ) : (
          <>
            <div className="info-group">
              <label>Name</label>
              <p>{userProfile?.displayName || 'Not set'}</p>
            </div>
            <div className="info-group">
              <label>Bio</label>
              <p>{userProfile?.bio || 'No bio yet'}</p>
            </div>
          </>
        )}

        {isEditing ? (
          <div className="button-group">
            <button onClick={handleProfileUpdate} disabled={loading}>Save Changes</button>
            <button onClick={() => setIsEditing(false)} className="cancel-button">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setIsEditing(true)} className="edit-button">
            Edit Profile
          </button>
        )}
      </div>

      <ActivityHistory />

      <div className="danger-zone">
        <h3>Danger Zone</h3>
        {showDeleteConfirm ? (
          <div className="delete-confirm">
            <p>Are you sure you want to delete your account? This cannot be undone.</p>
            <div className="button-group">
              <button onClick={handleDeleteAccount} className="delete-button" disabled={loading}>
                Yes, Delete My Account
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="cancel-button">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowDeleteConfirm(true)} className="delete-button">
            Delete Account
          </button>
        )}
      </div>

      <button onClick={handleLogout} className="logout-button">
        Log Out
      </button>
    </div>
  );
} 