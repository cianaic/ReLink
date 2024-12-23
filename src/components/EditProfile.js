import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { updateUserProfile, uploadProfilePicture, logActivity } from '../utils/database';

export default function EditProfile() {
  const [error, setError] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef();
  const { currentUser, userProfile, refreshUserProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setBio(userProfile.bio || '');
    }
  }, [userProfile]);

  async function handleProfileUpdate() {
    try {
      setLoading(true);
      const updates = {};
      
      if (displayName || userProfile?.displayName) {
        updates.displayName = displayName || userProfile?.displayName;
      }
      
      if (bio || userProfile?.bio) {
        updates.bio = bio || userProfile?.bio;
      }

      if (Object.keys(updates).length > 0) {
        await updateUserProfile(currentUser.uid, updates);
        await logActivity(currentUser.uid, 'profile_update', 'Updated profile information');
        await refreshUserProfile();
        navigate('/profile');
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
      setError('');
      
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB');
        return;
      }

      await uploadProfilePicture(currentUser.uid, file);
      await logActivity(currentUser.uid, 'profile_picture_update', 'Updated profile picture');
      await refreshUserProfile();
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Failed to upload profile picture');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="edit-profile-container">
      <h2>Edit Profile</h2>
      {error && <div className="error">{error}</div>}

      <div className="edit-profile-section">
        <div className="profile-photo-section">
          <h3>Profile Photo</h3>
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
              style={{ display: 'none' }}
              accept="image/*"
            />
          </div>
        </div>

        <div className="profile-info-section">
          <h3>Profile Information</h3>
          <div className="form-group">
            <label>Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself"
              className="form-input bio-input"
            />
          </div>
        </div>

        <div className="edit-profile-actions">
          <button 
            onClick={handleProfileUpdate}
            disabled={loading}
            className="save-button"
          >
            {loading ? 'Saving Changes...' : 'Save Changes'}
          </button>
          <button 
            onClick={() => navigate('/profile')}
            className="cancel-button"
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
} 