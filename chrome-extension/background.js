import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  projectId: "curate-f809d",
  appId: "1:960840861355:web:7459536ff753bace8d99ee",
  storageBucket: "curate-f809d.firebasestorage.app",
  apiKey: "AIzaSyACIxNAao0bBiGg-jpk2cPGtSTtXNLXGfE",
  authDomain: "curate-f809d.firebaseapp.com",
  messagingSenderId: "960840861355",
  measurementId: "G-S2N9BH7GEX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function getUserInfo() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, async function(token) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const userInfo = await response.json();
        resolve(userInfo);
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function saveLink(url) {
  try {
    // Get user info from Chrome identity
    const userInfo = await getUserInfo();
    if (!userInfo.sub) {
      throw new Error('Could not identify user');
    }

    // Save to Firestore with minimal data
    const linkData = {
      url: url,
      title: url, // Use URL as title for now
      userId: userInfo.sub,
      createdAt: new Date().toISOString(),
      isRead: false,
      comment: ''
    };

    await addDoc(collection(db, 'links'), linkData);
    console.log('Saved to Firestore:', linkData);

    // Show success notification
    chrome.notifications.create({
      type: 'basic',
      title: 'ReLink',
      message: 'Link saved to vault',
      iconUrl: 'icon48.png'
    });

    return { success: true };
  } catch (error) {
    console.error('Error saving link:', error);
    chrome.notifications.create({
      type: 'basic',
      title: 'ReLink Error',
      message: error.message || 'Failed to save link. Please try again.',
      iconUrl: 'icon48.png'
    });
    return { success: false, error: error.message };
  }
}

// Handle extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
  console.log('Extension clicked for tab:', tab.url);
  await saveLink(tab.url);
}); 