import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

export const firebaseConfig = {
  apiKey: "AIzaSyA-XumDD1GTf5_U4OGBn5r-hLkhuen5hyM",
  authDomain: "quotemyfence-flutter-and-webap.firebaseapp.com",
  databaseURL: "https://quotemyfence-flutter-and-webap-default-rtdb.firebaseio.com",
  projectId: "quotemyfence-flutter-and-webap",
  storageBucket: "quotemyfence-flutter-and-webap.firebasestorage.app",
  messagingSenderId: "417650414164",
  appId: "1:417650414164:web:823b187fbcfb66a03493c1",
  measurementId: "G-E9DCL744Z6"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
// Only bypass reCAPTCHA in local Vite — production must run real app verification
// or phone OTP fails with auth/captcha-check-failed (MALFORMED).
auth.settings.appVerificationDisabledForTesting = import.meta.env.DEV;
export const storage = getStorage(app);
export const rtdb = getDatabase(app);