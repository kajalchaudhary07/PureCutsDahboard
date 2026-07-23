import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function initAdminSdk() {
  if (getApps().length > 0) return;
  const keyPath = path.resolve("serviceAccountKey.json");
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Service account key not found at: ${keyPath}`);
  }
  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  initializeApp({ credential: cert(serviceAccount) });
}

async function run() {
  initAdminSdk();
  const db = getFirestore();

  console.log("=== Listing all documents in 'admins' collection ===");
  const adminSnap = await db.collection("admins").get();
  adminSnap.forEach(doc => {
    console.log(`Doc ID: ${doc.id}`);
    console.log(`Data: ${JSON.stringify(doc.data())}`);
  });
}

run().catch(console.error);
