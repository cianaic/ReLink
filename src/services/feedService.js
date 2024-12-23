import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  startAfter,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  Timestamp,
  updateDoc,
  getDoc
} from 'firebase/firestore';

const POSTS_PER_PAGE = 10;
const CACHE_DURATION = 30 * 1000; // 30 seconds

// Simple in-memory cache
const cache = new Map();

const getCacheKey = (userIds, page) => `feed:${userIds.sort().join(',')}:${page}`;

// Helper function to get week number
const getWeekNumber = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNumber;
};

// Helper function to get week start date
const getWeekStartDate = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7;
  if (day !== 1) {
    d.setHours(-24 * (day - 1));
  }
  return d;
};

// Helper function to format date stamp
const formatDateStamp = (date) => {
  const weekStart = getWeekStartDate(date);
  const weekNumber = getWeekNumber(date);
  const month = weekStart.toLocaleString('default', { month: 'long' });
  return {
    weekStart: weekStart,
    weekNumber: weekNumber,
    month: month,
    dateStamp: `${month}, Week ${weekNumber}`
  };
};

// Check if user has already posted this week
const hasPostedThisWeek = async (userId) => {
  try {
    console.log('Checking weekly post for user:', userId);
    
    // First check the user's profile for current week post
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const currentWeekPost = userDoc.data()?.currentWeekPost;

    if (currentWeekPost) {
      const postWeekStart = new Date(currentWeekPost.weekStart);
      const currentWeekStart = getWeekStartDate(new Date());
      
      // If the stored post is from the current week
      if (postWeekStart.getTime() === currentWeekStart.getTime()) {
        console.log('Found current week post in user profile:', currentWeekPost);
        return true;
      }
    }

    // If no current week post in profile, check the posts collection
    const weekStart = getWeekStartDate(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    console.log('Week range:', { weekStart, weekEnd });

    const q = query(
      collection(db, 'relinks'),
      where('userId', '==', userId),
      where('createdAt', '>=', Timestamp.fromDate(weekStart)),
      where('createdAt', '<', Timestamp.fromDate(weekEnd))
    );

    const snapshot = await getDocs(q);
    console.log('Weekly post check found documents:', snapshot.docs.length);
    
    if (!snapshot.empty) {
      // Update user profile with current week post info
      const post = snapshot.docs[0];
      await updateDoc(userRef, {
        currentWeekPost: {
          postId: post.id,
          weekStart: weekStart.toISOString(),
          weekNumber: getWeekNumber(weekStart),
          updatedAt: new Date().toISOString()
        }
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking weekly post:', error);
    throw new Error('Failed to check weekly post limit');
  }
};

// Get the current week's post
const getCurrentWeekPost = async (userId) => {
  try {
    const weekStart = getWeekStartDate(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    console.log('Getting current week post for user:', userId);
    console.log('Week range:', { weekStart, weekEnd });

    const q = query(
      collection(db, 'relinks'),
      where('userId', '==', userId),
      where('createdAt', '>=', Timestamp.fromDate(weekStart)),
      where('createdAt', '<', Timestamp.fromDate(weekEnd)),
      limit(1)
    );

    const snapshot = await getDocs(q);
    console.log('Current week post query returned:', snapshot.docs.length, 'documents');
    
    if (snapshot.empty) {
      console.log('No current week post found');
      return null;
    }
    
    const doc = snapshot.docs[0];
    const data = {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()
    };
    console.log('Found current week post:', data);
    return data;
  } catch (error) {
    console.error('Error getting current week post:', error);
    throw new Error('Failed to get current week post');
  }
};

const getFeedPage = async (page = 1, lastDoc = null, userIds = []) => {
  try {
    console.log('getFeedPage called with:', { page, lastDoc: !!lastDoc, userIds });

    if (!Array.isArray(userIds) || userIds.length === 0) {
      console.log('No user IDs provided, returning empty result');
      return {
        posts: [],
        lastVisible: null
      };
    }

    const cacheKey = getCacheKey(userIds, page);
    console.log('Cache key:', cacheKey);
    const cachedData = cache.get(cacheKey);
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION && page !== 1) {
      console.log('Returning cached data');
      return cachedData.data;
    }

    let q = collection(db, 'relinks');
    
    const constraints = [
      where('userId', 'in', userIds),
      orderBy('createdAt', 'desc'),
      limit(POSTS_PER_PAGE)
    ];

    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    q = query(q, ...constraints);
    console.log('Executing Firestore query with constraints:', constraints);
    const snapshot = await getDocs(q);
    console.log('Query returned', snapshot.docs.length, 'documents');

    const posts = snapshot.docs.map((doc) => {
      const data = doc.data();
      console.log('Processing post:', doc.id, 'data:', data);
      
      // Ensure links is always an array
      const links = data.links || [];
      console.log('Post links:', links);

      const authorInfo = {
        authorId: data.userId,
        authorName: data.authorName || 'Anonymous',
        authorPhotoURL: data.authorPhotoURL || null
      };
      
      return {
        id: doc.id,
        ...data,
        ...authorInfo,
        createdAt: data.createdAt?.toDate(),
        dateStamp: data.dateStamp,
        links: links
      };
    });

    console.log('Processed posts:', posts);

    const result = {
      posts,
      lastVisible: snapshot.docs[snapshot.docs.length - 1] || null
    };

    if (page !== 1) {
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      console.log('Cached result for key:', cacheKey);
    }

    return result;
  } catch (error) {
    console.error('Error fetching feed:', error);
    throw new Error('Failed to fetch feed posts');
  }
};

const createPost = async (postData) => {
  try {
    console.log('Creating new post with data:', postData);
    
    // Check if user has already posted this week
    const hasPosted = await hasPostedThisWeek(postData.userId);
    console.log('Has posted this week check result:', hasPosted);
    
    if (hasPosted) {
      console.log('User has already posted this week');
      throw new Error('You can only create one post per week');
    }

    // Add date stamp and author info
    const now = new Date();
    const dateInfo = formatDateStamp(now);
    
    const enhancedPostData = {
      ...postData,
      authorPhotoURL: postData.authorPhotoURL || null,
      createdAt: serverTimestamp(),
      dateStamp: dateInfo.dateStamp,
      weekNumber: dateInfo.weekNumber,
      weekStart: Timestamp.fromDate(dateInfo.weekStart),
      month: dateInfo.month
    };

    console.log('Enhanced post data:', enhancedPostData);
    const docRef = await addDoc(collection(db, 'relinks'), enhancedPostData);
    console.log('Post created with ID:', docRef.id);

    // Update user's profile with current week's post info
    const userRef = doc(db, 'users', postData.userId);
    await updateDoc(userRef, {
      currentWeekPost: {
        postId: docRef.id,
        weekStart: dateInfo.weekStart.toISOString(),
        weekNumber: dateInfo.weekNumber,
        updatedAt: new Date().toISOString()
      }
    });

    // Clear first page cache
    const firstPageCacheKey = getCacheKey([postData.userId], 1);
    if (cache.has(firstPageCacheKey)) {
      cache.delete(firstPageCacheKey);
      console.log('Cleared first page cache');
    }

    return docRef;
  } catch (error) {
    console.error('Error adding post:', error);
    throw error;
  }
};

const deletePost = async (postId, userId) => {
  try {
    console.log('Deleting post:', postId);
    const docRef = doc(db, 'relinks', postId);
    await deleteDoc(docRef);

    // Clear first page cache
    const firstPageCacheKey = getCacheKey([userId], 1);
    if (cache.has(firstPageCacheKey)) {
      cache.delete(firstPageCacheKey);
      console.log('Cleared first page cache after deletion');
    }

    // Check if this was the current week's post
    const weekStart = getWeekStartDate(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const q = query(
      collection(db, 'relinks'),
      where('userId', '==', userId),
      where('createdAt', '>=', Timestamp.fromDate(weekStart)),
      where('createdAt', '<', Timestamp.fromDate(weekEnd)),
      limit(1)
    );

    const snapshot = await getDocs(q);
    const noPostsRemain = snapshot.empty;

    // If this was the current week's post, update the user's profile
    if (noPostsRemain) {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        currentWeekPost: null
      });
    }

    return noPostsRemain;
  } catch (error) {
    console.error('Error deleting post:', error);
    throw new Error('Failed to delete post');
  }
};

// Update existing post
const updatePost = async (postData) => {
  try {
    const currentPost = await getCurrentWeekPost(postData.userId);
    if (!currentPost) {
      throw new Error('No post found for this week');
    }

    const docRef = doc(db, 'relinks', currentPost.id);
    await updateDoc(docRef, {
      ...postData,
      updatedAt: serverTimestamp()
    });

    // Clear first page cache
    const firstPageCacheKey = getCacheKey([postData.userId], 1);
    if (cache.has(firstPageCacheKey)) {
      cache.delete(firstPageCacheKey);
    }

    return docRef;
  } catch (error) {
    console.error('Error updating post:', error);
    throw error;
  }
};

const feedService = {
  getFeedPage,
  createPost,
  deletePost,
  hasPostedThisWeek,
  getCurrentWeekPost,
  updatePost
};

export default feedService; 