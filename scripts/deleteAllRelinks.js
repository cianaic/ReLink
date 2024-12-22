const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc } = require('firebase/firestore');
require('dotenv').config();

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function deleteAllRelinks() {
  try {
    const querySnapshot = await getDocs(collection(db, "relinks"));
    console.log(`Found ${querySnapshot.size} relinks to delete`);
    
    for (const doc of querySnapshot.docs) {
      await deleteDoc(doc.ref);
      console.log(`Deleted relink with ID: ${doc.id}`);
    }
    
    console.log('All relinks deleted successfully');
  } catch (error) {
    console.error('Error deleting relinks:', error);
  }
}

deleteAllRelinks(); 