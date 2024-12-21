import React, { useState, useEffect } from 'react';
import { getUserActivity } from '../utils/database';
import { useAuth } from '../contexts/AuthContext';

export default function ActivityHistory() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();

  useEffect(() => {
    async function fetchActivities() {
      try {
        const userActivities = await getUserActivity(currentUser.uid);
        setActivities(userActivities);
      } catch (error) {
        setError('Failed to load activity history');
      }
      setLoading(false);
    }

    fetchActivities();
  }, [currentUser]);

  if (loading) return <div>Loading activities...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="activity-history">
      <h3>Activity History</h3>
      {activities.length === 0 ? (
        <p>No recent activity</p>
      ) : (
        <ul className="activity-list">
          {activities.map(activity => (
            <li key={activity.id} className="activity-item">
              <span className="activity-action">{activity.action}</span>
              <span className="activity-time">
                {new Date(activity.timestamp).toLocaleDateString()}
              </span>
              {activity.details && (
                <p className="activity-details">{activity.details}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 