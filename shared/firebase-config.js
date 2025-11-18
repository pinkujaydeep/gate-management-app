// Firebase Configuration Template
// Replace with your actual Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyD7trjiELx6_7xlOymkPhAblMVL3x_RIA8",
    authDomain: "gate-management-app-fa3ac.firebaseapp.com",
    projectId: "gate-management-app-fa3ac",
    storageBucket: "gate-management-app-fa3ac.firebasestorage.app",
    messagingSenderId: "126396910502",
    appId: "1:126396910502:web:1ef0aa3ffa453e0d671d67"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Export for use in app.js
window.auth = auth;
window.db = db;
