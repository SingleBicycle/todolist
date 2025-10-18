import {
  collection,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "./config";

// ------------------
// Users
// ------------------

// Create should be handled by auth.js by logging in

// Read
async function getUserById(uid) {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      return {
        id: userDoc.id,
        ...userDoc.data(),
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching user:", error);
    throw error;
  }
}

async function getAllUsers() {
  try {
    // Fetch all documents from users collection
    const querySnapshot = await getDocs(collection(db, "users"));

    // Map documents to an array of user objects
    const users = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return users;
  } catch (error) {
    console.error("Error fetching all users:", error);
    throw error;
  }
}

// Update
async function updateUser(uid, updateData) {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      ...updateData,
    });
    return true;
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
}

// Delete
async function deleteUser(uid) {
  try {
    const userRef = doc(db, "users", uid);
    await deleteDoc(userRef);
    return true;
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}

// ------------------
// Characters
// ------------------

export async function getCharacterById(characterid) {
  try {
    const charDoc = await getDoc(doc(db, "characters", characterid));
    if (charDoc.exists()) {
      return { id: charDoc.characterid, ...charDoc.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Failed to get character", error);
    throw error;
  }
}

export async function getAllCharacters() {
  try {
    const snapshot = await getDocs(collection(db, "characters"));
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching characters:", error);
    throw error;
  }
}

export async function getRandomCharacter() {
  const all = await getAllCharacters();
  if (all.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * all.length);
  return all[randomIndex];
}

export async function getDifficultyCharacter(level) {
  const diff = await getAllCharacters();
  return diff.filter((char) => char.difficulty === level);
}

export { getUserById, getAllUsers, updateUser, deleteUser };
