import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, googleProvider } from "./config";

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

    return result.user;
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
    return result.user;
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

export { getCurrentUser, logout, loginAnonymously, loginWithGoogle };
