import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebaseConfig";

// ─── Generic helpers ───────────────────────────────────────────────────────────

export const getAll = async (col) => {
  const snap = await getDocs(collection(db, col));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addItem = async (col, data) => {
  return await addDoc(collection(db, col), {
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const updateItem = async (col, id, data) => {
  return await updateDoc(doc(db, col, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteItem = async (col, id) => {
  return await deleteDoc(doc(db, col, id));
};

// ─── Products ──────────────────────────────────────────────────────────────────
export const getProducts = () => getAll("products");
export const addProduct = (data) => addItem("products", data);
export const updateProduct = (id, data) => updateItem("products", id, data);
export const deleteProduct = (id) => deleteItem("products", id);

export const createProduct = (data) => addItem("products", data);

export const createVariant = async (productId, data) => {
  return await addDoc(collection(db, "products", productId, "variants"), {
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const getProductVariants = async (productId) => {
  const snap = await getDocs(
    query(collection(db, "products", productId, "variants"), orderBy("createdAt", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const deleteProductVariant = async (productId, variantId) => {
  return await deleteDoc(doc(db, "products", productId, "variants", variantId));
};

// ─── Attributes ────────────────────────────────────────────────────────────────
export const getAttributes = () => getAll("attributes");
export const addAttribute = (data) => addItem("attributes", data);
export const updateAttribute = (id, data) => updateItem("attributes", id, data);
export const deleteAttribute = (id) => deleteItem("attributes", id);

// ─── Brands ────────────────────────────────────────────────────────────────────
export const getBrands = () => getAll("brands");
export const addBrand = (data) => addItem("brands", data);
export const updateBrand = (id, data) => updateItem("brands", id, data);
export const deleteBrand = (id) => deleteItem("brands", id);

// ─── Categories ────────────────────────────────────────────────────────────────
export const getCategories = () => getAll("categories");
export const addCategory = (data) => addItem("categories", data);
export const updateCategory = (id, data) => updateItem("categories", id, data);
export const deleteCategory = (id) => deleteItem("categories", id);

// ─── Sub-Categories ────────────────────────────────────────────────────────────
export const getSubCategories = () => getAll("subCategories");
export const addSubCategory = (data) => addItem("subCategories", data);
export const updateSubCategory = (id, data) =>
  updateItem("subCategories", id, data);
export const deleteSubCategory = (id) => deleteItem("subCategories", id);

// ─── Product Reviews ──────────────────────────────────────────────────────────
const REVIEW_COLLECTIONS = ["productReviews", "reviews"];

const getCollectionDocsSafe = async (colName) => {
  try {
    const ordered = await getDocs(
      query(collection(db, colName), orderBy("createdAt", "desc"))
    );
    return ordered.docs.map((d) => ({ id: d.id, __col: colName, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(db, colName));
    return snap.docs.map((d) => ({ id: d.id, __col: colName, ...d.data() }));
  }
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const getProductReviews = async () => {
  const all = await Promise.all(REVIEW_COLLECTIONS.map((name) => getCollectionDocsSafe(name)));
  const merged = all.flat();
  merged.sort((a, b) => {
    const bTime = toMillis(b.createdAt) || toMillis(b.submittedAt);
    const aTime = toMillis(a.createdAt) || toMillis(a.submittedAt);
    return bTime - aTime;
  });
  return merged;
};

export const addProductReview = async (data) => {
  return await addDoc(collection(db, "productReviews"), {
    ...data,
    approved: Boolean(data.approved),
    status: data.approved ? "approved" : "pending",
    visibility: data.approved ? "global" : "author_only",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const approveProductReview = async (id, extra = {}, collectionName = "productReviews") => {
  return await updateDoc(doc(db, collectionName, id), {
    approved: true,
    status: "approved",
    visibility: "global",
    approvedAt: serverTimestamp(),
    ...extra,
    updatedAt: serverTimestamp(),
  });
};

export const setProductReviewStatus = async (
  id,
  status,
  extra = {},
  collectionName = "productReviews"
) => {
  const approved = status === "approved";
  return await updateDoc(doc(db, collectionName, id), {
    status,
    approved,
    visibility: approved ? "global" : "author_only",
    ...(approved ? { approvedAt: serverTimestamp() } : {}),
    ...extra,
    updatedAt: serverTimestamp(),
  });
};
