const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors')({ origin: true });

// Initialize Firebase Admin
admin.initializeApp();

exports.fetchUrlMetadata = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      // Check authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('Missing or invalid authorization header');
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      try {
        const idToken = authHeader.split('Bearer ')[1];
        await admin.auth().verifyIdToken(idToken);
      } catch (authError) {
        console.error('Auth error:', authError);
        res.status(401).json({ error: 'Invalid authentication token' });
        return;
      }

      // Get URL from request body
      const { url } = req.body;
      if (!url) {
        console.error('Missing URL in request body');
        res.status(400).json({ error: 'URL is required' });
        return;
      }

      console.log('Fetching metadata for URL:', url);

      // Fetch metadata using iframely
      const iframelyApiKey = functions.config().iframely.key;
      if (!iframelyApiKey) {
        console.error('Iframely API key not configured');
        res.status(500).json({ error: 'API configuration missing' });
        return;
      }

      try {
        // Add options to get more complete metadata
        const iframelyUrl = `https://iframe.ly/api/iframely?url=${encodeURIComponent(url)}&api_key=${iframelyApiKey}&omit_script=1`;
        const response = await axios({
          method: 'GET',
          url: iframelyUrl,
          timeout: 10000 // 10 second timeout
        });

        if (!response.data) {
          console.error('No data received from Iframely API');
          throw new Error('No data received from Iframely API');
        }

        console.log('Successfully fetched metadata:', response.data);

        // Extract metadata from iframely response
        const metadata = response.data;
        
        // Try to get the most meaningful title
        let title = '';
        if (metadata.meta?.title) {
          title = metadata.meta.title;
        } else if (metadata.meta?.site) {
          title = metadata.meta.site;
        } else if (metadata.title) {
          title = metadata.title;
        } else {
          // If no title found, try to get site name or hostname
          const urlObj = new URL(url);
          title = metadata.meta?.site_name || urlObj.hostname;
        }

        res.json({
          data: {
            title: title,
            description: metadata.meta?.description || '',
            image: metadata.links?.thumbnail?.[0]?.href || metadata.links?.icon?.[0]?.href || '',
            url: metadata.url || url,
            author: metadata.meta?.author || '',
            site: metadata.meta?.site || '',
            date: metadata.meta?.date || ''
          }
        });
      } catch (apiError) {
        console.error('Iframely API error:', apiError.response?.data || apiError.message);
        
        // Fallback to basic URL info
        const urlObj = new URL(url);
        console.log('Falling back to basic URL info for:', urlObj.hostname);
        
        res.json({
          data: {
            title: urlObj.hostname,
            description: '',
            image: '',
            url: url,
            author: '',
            site: urlObj.hostname,
            date: ''
          }
        });
      }
    } catch (error) {
      console.error('General error:', error);
      res.status(500).json({ 
        error: 'Failed to process URL',
        details: error.message
      });
    }
  });
}); 