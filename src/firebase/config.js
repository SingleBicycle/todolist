import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");

export { auth, db, app, googleProvider };


// functions/index.js
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { beforeUserCreated, beforeUserSignedIn } = require('firebase-functions/v2/identity');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

// AUTHENTICATION TRIGGER - Runs when user signs up
exports.createUserProfile = beforeUserCreated(async (event) => {
  const user = event.data;

  console.log('Creating profile for user:', user.id);

  try {
    const date = new Date();
    const unixTimestamp = Math.floor(date.getTime() / 1000);
    // Create user document in Firestore
    await db.collection('users').doc(user.id).set({
      id: user.id,
      email: user.email,
      firstName: user.firstname,
      lastName: user.lastname,
      points: 0,
      lastWord: null,
      completeWords: [],
      randomMode: false,
      photoURL: user.photoURL || null,
      lastLoginAt: unixTimestamp,
      lastPlayAt: null,
      createAt: unixTimestamp,
    });

    console.log('User profile created successfully');

    // Return the user (required for beforeUserCreated)
    return user;

  } catch (error) {
    console.error('Error creating user profile:', error);
    throw new HttpsError('internal', 'Failed to create user profile');
  }
});

// UPDATE LOGIN STATS - Runs when user signs in
exports.updateLoginStats = beforeUserSignedIn(async (event) => {
  const user = event.data;
  const date = new Date();
  const unixTimestamp = Math.floor(date.getTime() / 1000);
  try {
    await db.collection('users').doc(user.id).update({
      lastLoginAt: unixTimestamp
    });
    
    console.log('Login stats updated for user:', user.id);
    return user;
  } catch (error) {
    console.error('Error updating login stats:', error);
    // Don't throw here - we don't want to block sign-in
  }
});

