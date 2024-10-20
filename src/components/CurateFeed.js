import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

export default function CurateFeed() {
  const [friendsLinks, setFriendsLinks] = useState([]);
  const { currentUser } = useAuth();

  useEffect(() => {
    loadFriendsLinks();
  }, []);

  const loadFriendsLinks = async () => {
    // This is a placeholder. You'll need to implement a friends system
    // and then query for friends' links here.
    const q = query(
      collection(db, "links"),
      where("userId", "!=", currentUser.uid),
      where("createdAt", ">=", getStartOfCurrentMonth())
    );
    const querySnapshot = await getDocs(q);
    setFriendsLinks(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const getStartOfCurrentMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  return (
    <div>
      <h2>Friends' Links This Month</h2>
      <ul>
        {friendsLinks.map(link => (
          <li key={link.id}>
            <a href={link.url}>{link.title}</a>
            <p>{link.description}</p>
            <p>Shared by: {link.userId}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}