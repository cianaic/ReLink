// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

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
const auth = getAuth(app);

export { db, auth }; 