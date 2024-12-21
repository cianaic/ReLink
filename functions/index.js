const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin
admin.initializeApp();

exports.fetchUrlMetadata = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { url } = data;
  if (!url) {
    throw new functions.https.HttpsError('invalid-argument', 'URL is required');
  }

  try {
    const apiKey = functions.config().linkpreview.key;
    const response = await axios.post('https://api.linkpreview.net', 
      { q: url },
      {
        headers: {
          'X-Linkpreview-Api-Key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data) {
      throw new Error('No data received from LinkPreview API');
    }

    return response.data;
  } catch (error) {
    console.error('LinkPreview API error:', error.response?.data || error.message);
    
    // Return basic URL info on error
    const urlObj = new URL(url);
    return {
      title: urlObj.hostname,
      description: '',
      image: '',
      url: url
    };
  }
}); 