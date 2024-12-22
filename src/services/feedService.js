import { db } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs, 
  where,
  addDoc as firestoreAddDoc,
  Timestamp 
} from 'firebase/firestore';

const POSTS_PER_PAGE = 10;

const feedService = {
  async getLastVisibleDoc(page) {
    if (page < 1) return null;
    
    try {
      const postsRef = collection(db, "shared_relinks");
      const q = query(
        postsRef,
        orderBy("createdAt", "desc"),
        limit(page * POSTS_PER_PAGE)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs[querySnapshot.docs.length - 1];
    } catch (error) {
      console.error('Error getting last visible doc:', error);
      return null;
    }
  },

  async addDoc(post) {
    try {
      const postsRef = collection(db, "shared_relinks");
      const docRef = await firestoreAddDoc(postsRef, {
        ...post,
        createdAt: Timestamp.now()
      });
      return docRef;
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  },

  async getFeedPage(page = 1, lastVisibleDoc = null) {
    const postsRef = collection(db, "shared_relinks");
    let q;

    try {
      if (page === 1) {
        q = query(
          postsRef,
          orderBy("createdAt", "desc"),
          limit(POSTS_PER_PAGE)
        );
      } else if (lastVisibleDoc) {
        q = query(
          postsRef,
          orderBy("createdAt", "desc"),
          startAfter(lastVisibleDoc),
          limit(POSTS_PER_PAGE)
        );
      } else {
        throw new Error('Last visible document is required for pagination');
      }

      const snapshot = await getDocs(q);
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate().toISOString()
      }));

      const lastVisible = snapshot.docs[snapshot.docs.length - 1];
      return { posts, lastVisible };
    } catch (error) {
      console.error('Error getting feed page:', error);
      throw error;
    }
  }
};

export default feedService; 