import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const email = "kanojiyavivek8888@gmail.com";

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
  const auth = getAuth();
  const db = getFirestore();

  console.log(`=== Checking Auth User for ${email} ===`);
  try {
    const user = await auth.getUserByEmail(email);
    console.log(`Auth UID: ${user.uid}`);
    console.log(`Auth Custom Claims: ${JSON.stringify(user.customClaims || {})}`);
    console.log(`Auth Email Verified: ${user.emailVerified}`);
  } catch (error) {
    console.log(`Auth check failed: ${error.message}`);
  }

  console.log(`\n=== Checking Firestore 'users' collection ===`);
  try {
    const userSnap = await db.collection("users").where("email", "==", email).get();
    if (userSnap.empty) {
      console.log("No document in 'users' collection with this email.");
    } else {
      userSnap.forEach(doc => {
        console.log(`Document ID: ${doc.id}`);
        console.log(`Data: ${JSON.stringify(doc.data())}`);
      });
    }
  } catch (error) {
    console.log(`Firestore 'users' check failed: ${error.message}`);
  }

  console.log(`\n=== Checking Firestore 'admins' collection ===`);
  try {
    const adminSnap = await db.collection("admins").where("email", "==", email).get();
    if (adminSnap.empty) {
      console.log("No document in 'admins' collection with this email.");
    } else {
      adminSnap.forEach(doc => {
        console.log(`Document ID: ${doc.id}`);
        console.log(`Data: ${JSON.stringify(doc.data())}`);
      });
    }
  } catch (error) {
    console.log(`Firestore 'admins' check failed: ${error.message}`);
  }
}

run().catch(console.error);
