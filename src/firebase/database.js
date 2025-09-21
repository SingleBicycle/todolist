import { collection, doc, addDoc, getDoc, updateDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from './config'; 

// ------------------
// Users
// ------------------

// Create should be handled by auth.js by logging in

// Read
async function getUserById(uid) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return {
        id: userDoc.id, 
        ...userDoc.data() 
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}

// Update
async function updateUser(uid, updateData) {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...updateData
    });
    return true; 
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

// Delete
async function deleteUser(uid) {
  try {
    const userRef = doc(db, 'users', uid);
    await deleteDoc(userRef);
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}