import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  signInWithPopup
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { saveUserProfile, getUserProfile } from '../utils/database';

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
    // Create initial user profile
    await saveUserProfile(result.user.uid, {
      email: result.user.email,
      createdAt: new Date().toISOString(),
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      lastSignIn: new Date().toISOString()
    });
    return result;
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  async function signInWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    // Create/update user profile for Google sign-in
    await saveUserProfile(result.user.uid, {
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      lastSignIn: new Date().toISOString(),
      createdAt: new Date().toISOString()
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