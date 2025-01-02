import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp 
} from 'firebase/firestore';

// Get user's friends
export const getFriends = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const friendIds = userDoc.data()?.connections || [];
    
    const friendsData = await Promise.all(
      friendIds.map(async (friendId) => {
        const friendDoc = await getDoc(doc(db, 'users', friendId));
        return { uid: friendId, ...friendDoc.data() };
      })
    );
    
    return friendsData;
  } catch (error) {
    console.error('Error getting friends:', error);
    throw new Error('Failed to load friends');
  }
};

// Get pending friend requests
export const getPendingRequests = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const requestIds = userDoc.data()?.pendingRequests || [];
    
    const requestsData = await Promise.all(
      requestIds.map(async (requesterId) => {
        const requesterDoc = await getDoc(doc(db, 'users', requesterId));
        return { uid: requesterId, ...requesterDoc.data() };
      })
    );
    
    return requestsData;
  } catch (error) {
    console.error('Error getting pending requests:', error);
    throw new Error('Failed to load pending requests');
  }
};

// Send friend request
export const sendFriendRequest = async (senderId, receiverId) => {
  try {
    // First create the connection document
    const connectionRef = await addDoc(collection(db, 'connections'), {
      users: [senderId, receiverId],
      status: 'pending',
      createdAt: serverTimestamp(),
      senderId: senderId,
      receiverId: receiverId
    });

    // Then update the users' documents
    const receiverRef = doc(db, 'users', receiverId);
    const senderRef = doc(db, 'users', senderId);
    
    await Promise.all([
      updateDoc(receiverRef, {
        pendingRequests: arrayUnion(senderId)
      }),
      updateDoc(senderRef, {
        sentRequests: arrayUnion(receiverId)
      })
    ]);

    return connectionRef.id;
  } catch (error) {
    console.error('Error sending friend request:', error);
    throw new Error('Failed to send friend request');
  }
};

// Accept friend request
export const acceptFriendRequest = async (userId, requesterId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const requesterRef = doc(db, 'users', requesterId);
    
    // Update both users' documents
    await Promise.all([
      updateDoc(userRef, {
        pendingRequests: arrayRemove(requesterId),
        connections: arrayUnion(requesterId)
      }),
      updateDoc(requesterRef, {
        sentRequests: arrayRemove(userId),
        connections: arrayUnion(userId)
      })
    ]);
    
    // Update connection status
    const connectionsRef = collection(db, 'connections');
    const q = query(connectionsRef, 
      where('users', 'array-contains', userId),
      where('status', '==', 'pending')
    );
    
    const querySnapshot = await getDocs(q);
    const updatePromises = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.users.includes(requesterId)) {
        updatePromises.push(updateDoc(doc.ref, { 
          status: 'accepted',
          acceptedAt: serverTimestamp()
        }));
      }
    });

    await Promise.all(updatePromises);
  } catch (error) {
    console.error('Error accepting friend request:', error);
    throw new Error('Failed to accept friend request');
  }
};

// Reject friend request
export const rejectFriendRequest = async (userId, requesterId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const requesterRef = doc(db, 'users', requesterId);
    
    // Update both users' documents
    await Promise.all([
      updateDoc(userRef, {
        pendingRequests: arrayRemove(requesterId)
      }),
      updateDoc(requesterRef, {
        sentRequests: arrayRemove(userId)
      })
    ]);
    
    // Delete the connection document
    const connectionsRef = collection(db, 'connections');
    const q = query(connectionsRef, 
      where('users', 'array-contains', userId),
      where('status', '==', 'pending')
    );
    
    const querySnapshot = await getDocs(q);
    const deletePromises = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.users.includes(requesterId)) {
        deletePromises.push(deleteDoc(doc.ref));
      }
    });

    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    throw new Error('Failed to reject friend request');
  }
};

// Check friendship status between two users
export const checkFriendshipStatus = async (userId, targetUserId) => {
  try {
    // First check if they are already connected
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const connections = userDoc.data()?.connections || [];
    
    if (connections.includes(targetUserId)) {
      return 'friends';
    }

    // Check for pending requests
    const connectionsRef = collection(db, 'connections');
    const q = query(connectionsRef, 
      where('users', 'array-contains', userId),
      where('status', '==', 'pending')
    );
    
    const querySnapshot = await getDocs(q);
    let isPending = false;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.users.includes(targetUserId)) {
        isPending = true;
      }
    });

    return isPending ? 'pending' : 'none';
  } catch (error) {
    console.error('Error checking friendship status:', error);
    throw new Error('Failed to check friendship status');
  }
}; 