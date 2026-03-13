import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [claims, setClaims] = useState({ admin: false, superAdmin: false });
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser || null);

      if (!nextUser) {
        setClaims({ admin: false, superAdmin: false });
        setAuthLoading(false);
        return;
      }

      const tokenResult = await nextUser.getIdTokenResult(true);
      setClaims({
        admin: tokenResult.claims.admin === true,
        superAdmin: tokenResult.claims.superAdmin === true,
      });
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  const createProfileIfMissing = async (firebaseUser, meta = {}) => {
    const ref = doc(db, "users", firebaseUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return;

    await setDoc(ref, {
      uid: firebaseUser.uid,
      email: firebaseUser.email || "",
      name: meta.name || "",
      role: "staff",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const registerWithEmail = async ({ email, password, name }) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await createProfileIfMissing(cred.user, { name });
    return cred.user;
  };

  const loginWithEmail = async ({ email, password }) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value = useMemo(
    () => ({
      user,
      claims,
      authLoading,
      isAdmin: claims.admin || claims.superAdmin,
      isSuperAdmin: claims.superAdmin,
      registerWithEmail,
      loginWithEmail,
      logout,
    }),
    [user, claims, authLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
