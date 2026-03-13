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

async function run() {
  initAdminSdk();
  const auth = getAuth();

  const maxResults = Number(process.env.LIST_LIMIT || 100);
  const result = await auth.listUsers(maxResults);

  if (result.users.length === 0) {
    console.log("No Firebase Auth users found in this project.");
    return;
  }

  console.log(`Found ${result.users.length} user(s):`);
  for (const user of result.users) {
    console.log(
      `- uid=${user.uid} email=${user.email || "(no-email)"} disabled=${user.disabled}`
    );
  }
}

run().catch((error) => {
  console.error("Failed to list users:", error?.message || error);
  process.exitCode = 1;
});
