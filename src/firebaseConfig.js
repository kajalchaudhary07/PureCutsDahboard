import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCKu9aA60cAt4qvm9m63hPIIryYMQOHXgo",
  authDomain: "purecuts-11a7c.firebaseapp.com",
  projectId: "purecuts-11a7c",
  storageBucket: "purecuts-11a7c.firebasestorage.app",
  messagingSenderId: "285724819496",
  appId: "1:285724819496:web:aec9d12d0eba297b13b51d",
  measurementId: "G-Z9ET3XEDX8",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);
export default app;
