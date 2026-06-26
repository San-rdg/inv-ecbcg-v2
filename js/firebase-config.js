/**
 * Firebase Configuration
 * ----------------------
 * Initializes Firebase App, Firestore, and Auth using the compat SDK (v12.15.0).
 * 
 * IMPORTANT: Replace the placeholder values below with your actual Firebase project config.
 * You can find these values in your Firebase Console → Project Settings → General → Your apps → Web app.
 */


// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAMD3cqwFI9MsQkNMni3ZXJoXaZfds3bT8",
  authDomain: "ecbcg-pos.firebaseapp.com",
  projectId: "ecbcg-pos",
  storageBucket: "ecbcg-pos.firebasestorage.app",
  messagingSenderId: "950396174988",
  appId: "1:950396174988:web:2d8fe7ae236c52cd9331a9",
  measurementId: "G-7JPXHCEHMW"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Expose Firestore and Auth instances globally
window.db = firebase.firestore();
window.auth = firebase.auth();

console.log('[Firebase] Initialized successfully.');
