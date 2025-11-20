import {
  collection,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "./config";

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
    const charRef = doc(db, "characters", characterid);
    const charDoc = await getDoc(charRef);

    if (charDoc.exists()) {
      return { id: charDoc.id, ...charDoc.data() };
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

const cache = {};
export async function getDifficultyCharacter(level, language) {
  if (language.toLowerCase() == "chinese") {
    language = "ch";
  } else if (language.toLowerCase() == "japanese") {
    language = "jp";
  }

  const cacheKey = `${level}-${language}`;

  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  const q = query(
    collection(db, "characters"),
    where("difficulty", "==", level),
    where("language", "==", language)
  );

  const snapshot = await getDocs(q);
  const result = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  console.log(result);
  cache[cacheKey] = result;
  return result;
}

export { getUserById, getAllUsers, updateUser, deleteUser };