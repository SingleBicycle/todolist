import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./config";

// Create user profile if it doesn't exist yet
// Otherwise just update the login date
const createUserProfile = async (user) => {
  if (!user) return null;

  const userRef = doc(db, "users", user.uid);
  const date = new Date();
  const timestamp = Math.floor(date.getTime() / 1000);

  try {
    // Check if user already exists
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // Create new user profile with default values if user does not exist
      await setDoc(userRef, {
        email: user.email || "",
        photo_url: user.photoURL,
        first_name: user.displayName ? user.displayName.split(" ")[0] : "",
        last_name: user.displayName ? user.displayName.split(" ")[1] || "" : "",
        is_admin: false,
        points: 0,
        last_word: "2UrPjFYn9j62Q1K29AyW",
        completed_words: [],
        is_on_random_mode: false,
        last_login_at: timestamp,
        last_played_at: null,
        created_at: timestamp,
      });
    } else {
      await updateDoc(userRef, {
        photo_url: user.photoURL,
        last_login_at: timestamp,
      });
    }

    return (await getDoc(userRef)).data();
  } catch (error) {
    console.error("Error creating/updating user profile:", error);
    return null;
  }
};

const getCurrentUser = () => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        if (user) {
          resolve({
            displayName: user.displayName,
            photoURL: user.photoURL,
            email: user.email,
            uid: user.uid,
          });
        } else {
          resolve(null); // no user signed in
        }
      },
      reject
    );
  });
};

const loginAnonymously = async () => {
  try {
    if (getCurrentUser !== null) {
      await logout();
    }
    const result = await signInAnonymously(auth);

    // return await createUserProfile(result.user);
  } catch (error) {
    console.error(error);
  }
  return null;
};

const loginWithGoogle = async () => {
  try {
    if (getCurrentUser !== null) {
      await logout();
    }
    const result = await signInWithPopup(auth, googleProvider);
    return await createUserProfile(result.user);
  } catch (err) {
    console.error(err);
  }

  return null;
};

const logout = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error("Sign out error:", error);
  }
  return null;
};

export {
  createUserProfile,
  getCurrentUser,
  logout,
  loginAnonymously,
  loginWithGoogle,
};