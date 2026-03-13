import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

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
  const uid = await resolveUid(auth);
  const role = (process.env.ROLE || "admin").trim().toLowerCase();

  if (!["admin", "superadmin"].includes(role)) {
    throw new Error("Invalid ROLE. Use ROLE=admin or ROLE=superadmin");
  }

  const existing = await auth.getUser(uid);
  const currentClaims = existing.customClaims || {};

  const nextClaims = {
    ...currentClaims,
    admin: true,
    superAdmin: role === "superadmin",
  };

  await auth.setCustomUserClaims(uid, nextClaims);

  await auth.revokeRefreshTokens(uid);

  console.log(
    role === "superadmin"
      ? "✅ Super Admin claim assigned successfully"
      : "✅ Admin claim assigned successfully"
  );
  console.log(`UID: ${uid}`);
  if (existing.email) console.log(`Email: ${existing.email}`);
  console.log(`Claims set: ${JSON.stringify(nextClaims)}`);
  console.log("Action required: sign out and sign in again to refresh ID token claims.");
}

run().catch((error) => {
  console.error("❌ Failed to set admin claim:", error?.message || error);
  process.exitCode = 1;
});
