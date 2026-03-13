import { initializeApp } from "firebase/app";
import {
  getFirestore,
  writeBatch,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { brands, categories, subCategories, products } from "./seedData.js";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyCKu9aA60cAt4qvm9m63hPIIryYMQOHXgo",
  authDomain:
    process.env.VITE_FIREBASE_AUTH_DOMAIN || "purecuts-11a7c.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "purecuts-11a7c",
  storageBucket:
    process.env.VITE_FIREBASE_STORAGE_BUCKET || "purecuts-11a7c.firebasestorage.app",
  messagingSenderId:
    process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "285724819496",
  appId:
    process.env.VITE_FIREBASE_APP_ID || "1:285724819496:web:aec9d12d0eba297b13b51d",
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || "G-Z9ET3XEDX8",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

async function seedCollection(collectionName, items, idBuilder) {
  let batch = writeBatch(db);
  let opCount = 0;
  let written = 0;

  const commitAndReset = async () => {
    if (opCount === 0) return;
    await batch.commit();
    batch = writeBatch(db);
    opCount = 0;
  };

  for (const item of items) {
    const id = idBuilder(item);
    const ref = doc(db, collectionName, id);

    batch.set(ref, {
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    opCount += 1;
    written += 1;

    if (opCount >= 450) {
      await commitAndReset();
    }
  }

  await commitAndReset();
  return written;
}

async function run() {
  console.log("🚀 Seeding Firestore for PureCuts dashboard...");

  const counts = {};

  counts.brands = await seedCollection("brands", brands, (item) =>
    `brand_${slugify(item.name)}`
  );

  counts.categories = await seedCollection("categories", categories, (item) =>
    `category_${slugify(item.name)}`
  );

  counts.subCategories = await seedCollection(
    "subCategories",
    subCategories,
    (item) => `subcategory_${slugify(item.parentCategory)}_${slugify(item.name)}`
  );

  counts.products = await seedCollection("products", products, (item) =>
    `product_${slugify(item.name)}`
  );

  console.log("✅ Firestore seed complete:");
  console.table(counts);
  console.log("\nCollections seeded: brands, categories, subCategories, products");
  console.log("You can now open dashboard and Flutter app with matching schema.");
}

run().catch((error) => {
  console.error("❌ Seed failed:", error?.message || error);
  process.exitCode = 1;
});
