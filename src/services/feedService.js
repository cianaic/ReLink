import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  getDoc,
  doc, 
  updateDoc, 
  deleteDoc, 
  Timestamp,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase';

const POSTS_PER_PAGE = 10;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

const getMonthStartDate = (date) => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const getMonthName = (date) => {
  return new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);
};

const getCacheKey = (userIds, page) => {
  return `feed:${userIds.join(',')}:${page}`;
};

// Check if user has already posted this month
const hasPostedThisMonth = async (userId) => {
  try {
    console.log('Checking monthly post for user:', userId);
    
    // First check the user's profile for current month post
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.log('User document not found');
      return false;
    }

    const userData = userDoc.data();
    console.log('User data:', userData);
    
    const currentMonthPost = userData?.currentMonthPost;
    console.log('Current month post from user profile:', currentMonthPost);

    if (currentMonthPost) {
      const postMonthStart = new Date(currentMonthPost.monthStart);
      const currentMonthStart = getMonthStartDate(new Date());
      
      console.log('Comparing month starts:', {
        postMonthStart: postMonthStart.toISOString(),
        currentMonthStart: currentMonthStart.toISOString()
      });
      
      // If the stored post is from the current month
      if (postMonthStart.getTime() === currentMonthStart.getTime()) {
        console.log('Found current month post in user profile');
        return true;
      }
    }

    // If no current month post in profile, check the posts collection
    const monthStart = getMonthStartDate(new Date());
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthStart.getMonth() + 1);

    console.log('Checking posts collection for month range:', { 
      monthStart: monthStart.toISOString(), 
      monthEnd: monthEnd.toISOString() 
    });

    const q = query(
      collection(db, 'relinks'),
      where('userId', '==', userId),
      where('createdAt', '>=', Timestamp.fromDate(monthStart)),
      where('createdAt', '<', Timestamp.fromDate(monthEnd))
    );

    const snapshot = await getDocs(q);
    console.log('Posts found for current month:', snapshot.docs.length);

    if (!snapshot.empty) {
      // Update user profile with current month post info
      const post = snapshot.docs[0];
      const postData = {
        currentMonthPost: {
          postId: post.id,
          monthStart: monthStart.toISOString(),
          monthNumber: monthStart.getMonth() + 1,
          monthName: getMonthName(monthStart),
          year: monthStart.getFullYear(),
          updatedAt: new Date().toISOString()
        }
      };
      
      console.log('Updating user profile with post data:', postData);
      await updateDoc(userRef, postData);
      return true;
    }

    console.log('No posts found for current month');
    return false;
  } catch (error) {
    console.error('Error checking monthly post:', error);
    return false;
  }
};

// Create a new post
const createPost = async (postData) => {
  try {
    const hasPosted = await hasPostedThisMonth(postData.userId);
    if (hasPosted) {
      throw new Error('You have already shared a ReLink this month');
    }

    // Validate monthly post data
    if (postData.type === 'monthly') {
      if (!Array.isArray(postData.monthlyLinks) || postData.monthlyLinks.length !== 5) {
        throw new Error('Monthly ReLink must contain exactly 5 links');
      }
    }

    const now = new Date();
    const monthStart = getMonthStartDate(now);
    const monthName = getMonthName(now);

    const docRef = await addDoc(collection(db, 'relinks'), {
      ...postData,
      createdAt: serverTimestamp(),
      monthStart: monthStart.toISOString(),
      monthName: monthName,
      year: now.getFullYear(),
      title: `${monthName} ${now.getFullYear()} ReLink`
    });

    // Update user's current month post
    const userRef = doc(db, 'users', postData.userId);
    await updateDoc(userRef, {
      currentMonthPost: {
        postId: docRef.id,
        monthStart: monthStart.toISOString(),
        monthNumber: now.getMonth() + 1,
        monthName: monthName,
        year: now.getFullYear(),
        updatedAt: new Date().toISOString()
      }
    });

    // Clear first page cache
    const firstPageCacheKey = getCacheKey([postData.userId], 1);
    if (cache.has(firstPageCacheKey)) {
      cache.delete(firstPageCacheKey);
    }

    return docRef;
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};

// Get feed posts
const getFeedPosts = async (page = 1, lastDoc = null, userIds = []) => {
  try {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return {
        posts: [],
        lastVisible: null
      };
    }

    console.log('Getting feed posts for users:', userIds);
    const currentUserId = userIds[0];
    const hasShared = await hasPostedThisMonth(currentUserId);
    
    // If user hasn't shared, they can only see their own posts
    if (!hasShared) {
      console.log('User has not shared, only showing their posts');
      userIds = [currentUserId];
    }

    const cacheKey = getCacheKey(userIds, page);
    const cachedData = cache.get(cacheKey);
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      console.log('Returning cached feed data');
      return cachedData.data;
    }

    console.log('Querying posts for users:', userIds);
    let q = query(
      collection(db, 'relinks'),
      where('userId', 'in', userIds),
      orderBy('createdAt', 'desc'),
      limit(POSTS_PER_PAGE)
    );

    const snapshot = await getDocs(q);
    console.log('Found posts:', snapshot.docs.length);
    
    const posts = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate()
      };
    });

    console.log('Processed posts:', posts);

    const result = {
      posts,
      lastVisible: snapshot.docs[snapshot.docs.length - 1] || null
    };

    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  } catch (error) {
    console.error('Error fetching feed:', error);
    throw new Error('Failed to fetch feed posts');
  }
};

const deletePost = async (postId, userId) => {
  try {
    const postRef = doc(db, 'relinks', postId);
    const postDoc = await getDoc(postRef);
    
    if (!postDoc.exists()) {
      throw new Error('Post not found');
    }

    const postData = postDoc.data();
    if (postData.userId !== userId) {
      throw new Error('Not authorized to delete this post');
    }

    // Delete the post
    await deleteDoc(postRef);

    // Update user's current month post if this was their monthly post
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.currentMonthPost?.postId === postId) {
        await updateDoc(userRef, {
          currentMonthPost: null
        });
      }
    }

    // Clear cache
    const firstPageCacheKey = getCacheKey([userId], 1);
    if (cache.has(firstPageCacheKey)) {
      cache.delete(firstPageCacheKey);
    }
  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
};

const toggleLike = async (postId, userId) => {
  try {
    const postRef = doc(db, 'relinks', postId);
    const postDoc = await getDoc(postRef);
    
    if (!postDoc.exists()) {
      throw new Error('Post not found');
    }

    const postData = postDoc.data();
    const likes = postData.likes || [];
    const hasLiked = likes.includes(userId);

    if (hasLiked) {
      // Unlike
      await updateDoc(postRef, {
        likes: likes.filter(id => id !== userId)
      });
    } else {
      // Like
      await updateDoc(postRef, {
        likes: [...likes, userId]
      });
    }

    // Clear cache
    const firstPageCacheKey = getCacheKey([userId], 1);
    if (cache.has(firstPageCacheKey)) {
      cache.delete(firstPageCacheKey);
    }

    return !hasLiked; // Return new like state
  } catch (error) {
    console.error('Error toggling like:', error);
    throw error;
  }
};

const deleteComment = async (postId, commentId, userId) => {
  try {
    const postRef = doc(db, 'relinks', postId);
    const postDoc = await getDoc(postRef);
    
    if (!postDoc.exists()) {
      throw new Error('Post not found');
    }

    const post = postDoc.data();
    const comments = post.comments || [];
    const comment = comments.find(c => c.id === commentId);

    if (!comment) {
      throw new Error('Comment not found');
    }

    // Only allow comment author or post author to delete the comment
    if (comment.userId !== userId && post.userId !== userId) {
      throw new Error('Not authorized to delete this comment');
    }

    // Remove the comment
    const updatedComments = comments.filter(c => c.id !== commentId);
    await updateDoc(postRef, { comments: updatedComments });

    // Clear cache for this post
    const cacheKeys = Array.from(cache.keys());
    cacheKeys.forEach(key => {
      if (key.includes(post.userId)) {
        cache.delete(key);
      }
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};

const feedService = {
  hasPostedThisMonth,
  createPost,
  getFeedPosts,
  deletePost,
  toggleLike,
  deleteComment
};

export default feedService; 