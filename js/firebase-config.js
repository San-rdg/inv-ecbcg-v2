/**
 * Firebase Configuration
 * ----------------------
 * Initializes Firebase App, Firestore, and Auth using the compat SDK (v12.15.0).
 * 
 * IMPORTANT: Replace the placeholder values below with your actual Firebase project config.
 * You can find these values in your Firebase Console → Project Settings → General → Your apps → Web app.
 */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",               // Replace with your API key
  authDomain: "YOUR_PROJECT.firebaseapp.com", // Replace with your auth domain
  projectId: "YOUR_PROJECT_ID",               // Replace with your project ID
  storageBucket: "YOUR_PROJECT.appspot.com",  // Replace with your storage bucket
  messagingSenderId: "YOUR_SENDER_ID",        // Replace with your messaging sender ID
  appId: "YOUR_APP_ID"                        // Replace with your app ID
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Expose Firestore and Auth instances globally
window.db = firebase.firestore();
window.auth = firebase.auth();

console.log('[Firebase] Initialized successfully.');
