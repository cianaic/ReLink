const { onRequest, onCall } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors')({ origin: true });
const { Redis } = require('@upstash/redis');
const functions = require('firebase-functions');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Redis client
const redis = new Redis({
  url: functions.config().upstash.redis_url,
  token: functions.config().upstash.redis_token
});

// Configure storage bucket CORS
const bucket = admin.storage().bucket();
bucket.setCorsConfiguration([
  {
    origin: ['*'],
    method: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    maxAgeSeconds: 3600,
  },
]);

// Upload profile picture function
exports.uploadProfilePicture = onRequest(
  { 
    cors: true,
    maxInstances: 10
  },
  async (req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '3600');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // Use multer middleware
    upload.single('file')(req, res, async (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: err.message });
      }

      try {
        // Verify Firebase ID token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(403).json({ error: 'Unauthorized' });
        }

        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        // Check if file exists in request
        if (!req.file) {
          return res.status(400).json({ error: 'No file provided' });
        }

        const file = req.file;
        const fileExtension = file.originalname.split('.').pop();
        const fileName = `profile-pictures/${userId}/${uuidv4()}.${fileExtension}`;

        // Upload file to Firebase Storage
        const fileBuffer = file.buffer;
        const fileRef = bucket.file(fileName);
        
        await fileRef.save(fileBuffer, {
          metadata: {
            contentType: file.mimetype,
            metadata: {
              firebaseStorageDownloadTokens: uuidv4(),
            }
          }
        });

        // Get the download URL
        const [downloadURL] = await fileRef.getSignedUrl({
          action: 'read',
          expires: '03-01-2500'
        });

        // Update user profile with new photo URL
        const userRef = admin.firestore().collection('users').doc(userId);
        await userRef.update({
          photoURL: downloadURL,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ photoURL: downloadURL });
      } catch (error) {
        console.error('Error uploading profile picture:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }
);

// Fetch URL metadata function
exports.fetchUrlMetadata = onRequest(
  { 
    cors: true,
    maxInstances: 10
  },
  async (req, res) => {
    try {
      // Verify Firebase ID token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }

      const idToken = authHeader.split('Bearer ')[1];
      await admin.auth().verifyIdToken(idToken);

      // Get URL from request body
      const { url } = req.body;
      if (!url) {
        res.status(400).json({ error: 'URL is required' });
        return;
      }

      // Call iframely API
      const iframelyUrl = `https://iframe.ly/api/iframely?url=${encodeURIComponent(url)}&api_key=${functions.config().iframely.key}`;
      const response = await axios.get(iframelyUrl);
      
      res.json({
        data: {
          title: response.data.meta?.title || response.data.title || url,
          description: response.data.meta?.description || '',
          image: response.data.links?.thumbnail?.[0]?.href || '',
          author: response.data.meta?.author || '',
          site: response.data.meta?.site || '',
          date: response.data.meta?.date || ''
        }
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Function to manage feed operations
exports.manageFeed = onCall(
  { 
    maxInstances: 10
  },
  async (data, context) => {
    if (!context.auth) {
      throw new Error('Must be logged in to manage feed.');
    }

    const { operation, payload } = data;

    switch (operation) {
      case 'invalidateCache':
        try {
          const cachePattern = 'feed:*';
          await redis.del(cachePattern);
          return { success: true, message: 'Cache invalidated successfully' };
        } catch (error) {
          console.error('Redis error:', error);
          throw new Error('Failed to invalidate cache');
        }

      case 'getFeedPage':
        try {
          const { page, userId } = payload;
          const cacheKey = `feed:${page}:${userId || 'public'}`;
          
          // Try to get from cache
          const cachedData = await redis.get(cacheKey);
          if (cachedData) {
            return { cached: true, data: JSON.parse(cachedData) };
          }

          // If not in cache, get from Firestore and cache it
          const postsRef = admin.firestore().collection('shared_relinks');
          const query = postsRef
            .orderBy('createdAt', 'desc')
            .limit(10)
            .offset((page - 1) * 10);

          const snapshot = await query.get();
          const posts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt.toDate().toISOString()
          }));

          // Cache the results
          await redis.set(cacheKey, JSON.stringify(posts), {
            ex: 300 // 5 minutes
          });

          return { cached: false, data: posts };
        } catch (error) {
          console.error('Feed error:', error);
          throw new Error('Failed to get feed data');
        }

      default:
        throw new Error('Invalid operation');
    }
  }
);

// Function to handle post creation with Redis cache invalidation
exports.onPostCreated = onDocumentCreated(
  { 
    document: 'shared_relinks/{postId}',
    maxInstances: 10
  },
  async (event) => {
    try {
      // Invalidate the feed cache
      const cachePattern = 'feed:*';
      await redis.del(cachePattern);
      
      console.log('Cache invalidated after new post creation');
    } catch (error) {
      console.error('Failed to invalidate cache:', error);
    }
  }
);

// Function to handle post updates with Redis cache invalidation
exports.onPostUpdated = onDocumentUpdated(
  { 
    document: 'shared_relinks/{postId}',
    maxInstances: 10
  },
  async (event) => {
    try {
      // Invalidate the feed cache
      const cachePattern = 'feed:*';
      await redis.del(cachePattern);
      
      console.log('Cache invalidated after post update');
    } catch (error) {
      console.error('Failed to invalidate cache:', error);
    }
  }
);

// Function to handle post deletion with Redis cache invalidation
exports.onPostDeleted = onDocumentDeleted(
  { 
    document: 'shared_relinks/{postId}',
    maxInstances: 10
  },
  async (event) => {
    try {
      // Invalidate the feed cache
      const cachePattern = 'feed:*';
      await redis.del(cachePattern);
      
      console.log('Cache invalidated after post deletion');
    } catch (error) {
      console.error('Failed to invalidate cache:', error);
    }
  }
);