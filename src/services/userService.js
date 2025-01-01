import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const updateProfile = async (userId, updates) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, updates);
};

export const getPublicProfile = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return null;
    }
    const userData = userDoc.data();
    // Only return public information
    return {
      displayName: userData.displayName || userData.email,
      photoURL: userData.photoURL || null,
      bio: userData.bio || null
    };
  } catch (error) {
    console.error('Error getting public profile:', error);
    return null;
  }
}; 