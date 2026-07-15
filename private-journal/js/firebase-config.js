// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyBo46FPOlqxJch5tRzb0OY0lcbUoDyKUR0",
  authDomain: "private-journal-850ba.firebaseapp.com",
  projectId: "private-journal-850ba",
  storageBucket: "private-journal-850ba.firebasestorage.app",
  messagingSenderId: "30056393345",
  appId: "1:30056393345:web:dac6422f9cb4ca5abdfb80",
  measurementId: "G-G0EYBGZD43"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);