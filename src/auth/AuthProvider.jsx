import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [claims, setClaims] = useState({ admin: false, superAdmin: false });
  const [rolePermissions, setRolePermissions] = useState([]);
  const [effectiveRole, setEffectiveRole] = useState("User");
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser || null);

      if (!nextUser) {
        setClaims({ admin: false, superAdmin: false });
        setRolePermissions([]);
        setEffectiveRole("User");
        setAuthLoading(false);
        return;
      }

      const tokenResult = await nextUser.getIdTokenResult(true);
      const nextClaims = {
        admin: tokenResult.claims.admin === true,
        superAdmin: tokenResult.claims.superAdmin === true,
      };
      setClaims(nextClaims);

      const roleName = nextClaims.superAdmin || nextClaims.admin ? "Admin" : "User";
      setEffectiveRole(roleName);

      try {
        const roleRef = doc(
          db,
          "rolePermissions",
          roleName
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
        );
        const roleSnap = await getDoc(roleRef);
        const rows = Array.isArray(roleSnap.data()?.permissions)
          ? roleSnap.data().permissions
          : [];
        setRolePermissions(rows);
      } catch {
        setRolePermissions([]);
      }

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

  const requestPasswordReset = async (email) => {
    const cleanEmail = String(email || "").trim();
    if (!cleanEmail) throw new Error("Email is required");
    await sendPasswordResetEmail(auth, cleanEmail);
  };

  const value = useMemo(
    () => ({
      user,
      claims,
      rolePermissions,
      effectiveRole,
      authLoading,
      isAdmin: claims.admin || claims.superAdmin,
      isSuperAdmin: claims.superAdmin,
      hasPermission: (resource, action = "view") => {
        if (claims.superAdmin) return true;
        const row = rolePermissions.find(
          (item) =>
            String(item?.resource || "").toLowerCase() === String(resource || "").toLowerCase()
        );
        if (!row) return claims.admin || false;
        return Boolean(row?.[action]);
      },
      registerWithEmail,
      loginWithEmail,
      requestPasswordReset,
      logout,
    }),
    [user, claims, rolePermissions, effectiveRole, authLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
