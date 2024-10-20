import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';

export default function MyFeed() {
  const [links, setLinks] = useState([]);
  const [newLink, setNewLink] = useState({ title: '', url: '', description: '' });
  const { currentUser } = useAuth();

  useEffect(() => {
    loadMyLinks();
  }, []);

  const loadMyLinks = async () => {
    const q = query(
      collection(db, "links"),
      where("userId", "==", currentUser.uid),
      where("createdAt", ">=", getStartOfCurrentMonth())
    );
    const querySnapshot = await getDocs(q);
    setLinks(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (links.length >= 5) {
      alert("You've already shared 5 links this month!");
      return;
    }
    await addDoc(collection(db, "links"), {
      ...newLink,
      userId: currentUser.uid,
      createdAt: Timestamp.now()
    });
    setNewLink({ title: '', url: '', description: '' });
    loadMyLinks();
  };

  const getStartOfCurrentMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  return (
    <div>
      <h2>My 5 Links of the Month</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Title"
          value={newLink.title}
          onChange={(e) => setNewLink({...newLink, title: e.target.value})}
        />
        <input
          type="url"
          placeholder="URL"
          value={newLink.url}
          onChange={(e) => setNewLink({...newLink, url: e.target.value})}
        />
        <textarea
          placeholder="Description"
          value={newLink.description}
          onChange={(e) => setNewLink({...newLink, description: e.target.value})}
        />
        <button type="submit">Add Link</button>
      </form>
      <ul>
        {links.map(link => (
          <li key={link.id}>
            <a href={link.url}>{link.title}</a>
            <p>{link.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}