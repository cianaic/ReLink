import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  signInWithPopup
} from 'firebase/auth';
import { auth, googleProvider, analytics } from '../firebase';
import { saveUserProfile, getUserProfile } from '../utils/database';
import { logEvent } from 'firebase/analytics';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function signup(email, password) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    // Create initial user profile with displayName from email
    const displayName = email.split('@')[0]; // Use part before @ as default name
    await saveUserProfile(result.user.uid, {
      email: result.user.email,
      displayName: result.user.displayName || displayName,
      createdAt: new Date().toISOString(),
      photoURL: result.user.photoURL,
      lastSignIn: new Date().toISOString()
    });
    logEvent(analytics, 'sign_up', {
      method: 'email'
    });
    return result;
  }

  async function login(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    logEvent(analytics, 'login', {
      method: 'email'
    });
    return result;
  }

  async function logout() {
    logEvent(analytics, 'logout');
    return signOut(auth);
  }

  async function signInWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    // Create/update user profile for Google sign-in
    await saveUserProfile(result.user.uid, {
      email: result.user.email,
      displayName: result.user.displayName || result.user.email.split('@')[0],
      photoURL: result.user.photoURL,
      lastSignIn: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
    logEvent(analytics, result.additionalUserInfo?.isNewUser ? 'sign_up' : 'login', {
      method: 'google'
    });
    return result;
  }

  async function refreshUserProfile() {
    if (currentUser) {
      try {
        const profile = await getUserProfile(currentUser.uid);
        setUserProfile(profile);
      } catch (error) {
        console.error('Error refreshing user profile:', error);
      }
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Fetch user profile when auth state changes
        try {
          const profile = await getUserProfile(user.uid);
          setUserProfile(profile);
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    signup,
    login,
    logout,
    signInWithGoogle,
    refreshUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}