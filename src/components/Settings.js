import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { deleteUserProfile } from '../utils/database';
import ActivityHistory from './ActivityHistory';

export default function Settings() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

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
    <div className="settings-container">
      <h2>Settings</h2>
      {error && <div className="error">{error}</div>}

      <div className="settings-section">
        <ActivityHistory />
      </div>

      <div className="settings-section">
        <h3>Delete Account</h3>
        <p className="warning-text">
          Warning: This action cannot be undone. All your data will be permanently deleted.
        </p>
        {!showDeleteConfirm ? (
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="delete-account-button"
          >
            Delete Account
          </button>
        ) : (
          <div className="delete-confirm">
            <p>Are you sure you want to delete your account?</p>
            <div className="delete-actions">
              <button 
                onClick={handleDeleteAccount}
                className="confirm-delete-button"
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Yes, Delete My Account'}
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="cancel-button"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 