import { db, storage, auth } from '../firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  deleteDoc, 
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  limit
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';

// Create or update user profile
export async function saveUserProfile(userId, data) {
  try {
    console.log('Attempting to save profile for user:', userId);
    console.log('Data to save:', data);
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log('Profile saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving user profile:', error);
    throw error;
  }
}

// Get user profile
export async function getUserProfile(userId) {
  try {
    console.log('Fetching profile for user:', userId);
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      console.log('Profile data:', userSnap.data());
      return userSnap.data();
    } else {
      console.log('No profile found for user');
      return null;
    }
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
}

// Update user profile
export async function updateUserProfile(userId, updates) {
  try {
    const userRef = doc(db, 'users', userId);
    
    // First check if the document exists
    const docSnap = await getDoc(userRef);
    
    if (!docSnap.exists()) {
      // If document doesn't exist, create it
      await setDoc(userRef, {
        ...updates,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } else {
      // If document exists, update it
      await updateDoc(userRef, {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

// Upload profile picture
export async function uploadProfilePicture(userId, file) {
  try {
    console.log('Starting profile picture upload for user:', userId);
    
    // Create a unique filename
    const fileExtension = file.name.split('.').pop();
    const fileName = `${userId}_${Date.now()}.${fileExtension}`;
    
    // Create the file reference
    const fileRef = ref(storage, `profile-pictures/${userId}/${fileName}`);
    console.log('Created storage reference');
    
    // Set metadata with CORS headers
    const metadata = {
      contentType: file.type,
      customMetadata: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      }
    };
    
    // Upload the file
    console.log('Uploading file...');
    const snapshot = await uploadBytes(fileRef, file, metadata);
    console.log('File uploaded successfully');
    
    // Get the download URL
    console.log('Getting download URL...');
    const photoURL = await getDownloadURL(snapshot.ref);
    console.log('Got download URL:', photoURL);
    
    // Update user profile with new photo URL
    console.log('Updating user profile with new photo URL');
    await updateUserProfile(userId, { photoURL });
    console.log('Profile picture update complete');
    
    return photoURL;
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    throw error;
  }
}

// Delete user profile and related data
export async function deleteUserProfile(userId) {
  try {
    // Delete profile picture from storage
    try {
      const fileRef = ref(storage, `profile-pictures/${userId}`);
      await deleteObject(fileRef);
    } catch (error) {
      console.log('No profile picture to delete');
    }

    // Delete user document
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);

    // Delete activity history
    const activitiesRef = collection(db, 'activities');
    const q = query(activitiesRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    return true;
  } catch (error) {
    console.error('Error deleting user profile:', error);
    throw error;
  }
}

// Log user activity
export async function logActivity(userId, action, details) {
  try {
    const activitiesRef = collection(db, 'activities');
    await addDoc(activitiesRef, {
      userId,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

// Get user activity history
export async function getUserActivity(userId, limitCount = 10) {
  try {
    const activitiesRef = collection(db, 'activities');
    const q = query(
      activitiesRef, 
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .slice(0, limitCount)  // Apply limit after getting docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
  } catch (error) {
    console.error('Error getting user activity:', error.message);
    if (error.code === 'failed-precondition') {
      console.log('Need to create index:', error);
    }
    throw error;
  }
} 