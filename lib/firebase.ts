
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBdIzpeLUjmhFdThk4zekRHrEvqkXkppw8",
  authDomain: "thumbnyltic-ai.firebaseapp.com",
  projectId: "thumbnyltic-ai",
  storageBucket: "thumbnyltic-ai.firebasestorage.app",
  messagingSenderId: "579243300878",
  appId: "1:579243300878:web:253c3b7f8c84865092c45f",
  measurementId: "G-H0Y5JJB228"
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Analytics (optional, for browser environments)
if (typeof window !== "undefined") {
  getAnalytics(app);
}

// Export Auth with explicit app reference to ensure registration
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
