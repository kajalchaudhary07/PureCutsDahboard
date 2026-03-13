import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { brands, categories, subCategories, products } from "./seedData.js";

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function resolveServiceAccountPath() {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), "serviceAccountKey.json");
}

function initAdmin() {
  if (getApps().length > 0) return;

  const keyPath = resolveServiceAccountPath();
  if (!fs.existsSync(keyPath)) {
    throw new Error(
      `Service account key not found at: ${keyPath}. Set FIREBASE_SERVICE_ACCOUNT_PATH in .env or place serviceAccountKey.json in purecuts-dash/`
    );
  }

  const raw = fs.readFileSync(keyPath, "utf8");
  const serviceAccount = JSON.parse(raw);

  initializeApp({
    credential: cert(serviceAccount),
  });
}

async function seedCollection(db, collectionName, items, idBuilder) {
  let batch = db.batch();
  let opCount = 0;
  let written = 0;

  const commitAndReset = async () => {
    if (opCount === 0) return;
    await batch.commit();
    batch = db.batch();
    opCount = 0;
  };

  for (const item of items) {
    const id = idBuilder(item);
    const ref = db.collection(collectionName).doc(id);

    batch.set(ref, {
      ...item,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
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
  console.log("🚀 Seeding Firestore via firebase-admin...");

  initAdmin();
  const db = getFirestore();

  const counts = {};

  counts.brands = await seedCollection(db, "brands", brands, (item) =>
    `brand_${slugify(item.name)}`
  );

  counts.categories = await seedCollection(db, "categories", categories, (item) =>
    `category_${slugify(item.name)}`
  );

  counts.subCategories = await seedCollection(
    db,
    "subCategories",
    subCategories,
    (item) => `subcategory_${slugify(item.parentCategory)}_${slugify(item.name)}`
  );

  counts.products = await seedCollection(db, "products", products, (item) =>
    `product_${slugify(item.name)}`
  );

  console.log("✅ Firestore seed complete:");
  console.table(counts);
}

run().catch((error) => {
  console.error("❌ Admin seed failed:", error?.message || error);
  process.exitCode = 1;
});
