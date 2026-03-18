import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, serverTimestamp } from "firebase-admin/firestore";

function resolveServiceAccountPath() {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), "serviceAccountKey.json");
}

function initAdminSdk() {
  if (getApps().length > 0) return;

  const keyPath = resolveServiceAccountPath();
  if (!fs.existsSync(keyPath)) {
    throw new Error(
      `Service account key not found at: ${keyPath}. Set FIREBASE_SERVICE_ACCOUNT_PATH in .env or place serviceAccountKey.json in purecuts-dash/`
    );
  }

  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  initializeApp({ credential: cert(serviceAccount) });
}

async function resolveUid(auth) {
  const uid = process.env.ADMIN_UID?.trim();
  if (uid) return uid;

  const email = process.env.ADMIN_EMAIL?.trim();
  if (!email) {
    throw new Error(
      "Provide ADMIN_UID or ADMIN_EMAIL in environment before running the script."
    );
  }

  const user = await auth.getUserByEmail(email);
  return user.uid;
}

async function run() {
  initAdminSdk();
  const auth = getAuth();
  const db = getFirestore();
  
  const uid = await resolveUid(auth);
  const role = (process.env.ROLE || "admin").trim().toLowerCase();
  const name = (process.env.ADMIN_NAME || "Admin User").trim();
  const email = (process.env.ADMIN_EMAIL || "").trim();

  if (!["admin", "superadmin"].includes(role)) {
    throw new Error("Invalid ROLE. Use ROLE=admin or ROLE=superadmin");
  }

  const existing = await auth.getUser(uid);
  const resolvedEmail = email || existing.email || "";

  // Create admin record in Firestore
  const adminDoc = db.collection("admins").doc(uid);
  
  await adminDoc.set({
    uid,
    name,
    email: resolvedEmail,
    phone: process.env.ADMIN_PHONE?.trim() || "",
    role,
    active: true,
    avatar: "",
    createdAt: serverTimestamp(),
  });

  console.log(
    role === "superadmin"
      ? "✅ Super Admin record created successfully"
      : "✅ Admin record created successfully"
  );
  console.log(`UID: ${uid}`);
  console.log(`Email: ${resolvedEmail}`);
  console.log(`Role: ${role}`);
  console.log(`Admin visible in dashboard`);
}

run().catch((error) => {
  console.error("❌ Failed to create admin record:", error?.message || error);
  process.exitCode = 1;
});
