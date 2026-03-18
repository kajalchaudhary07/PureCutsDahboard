import {
  collection,
  collectionGroup,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  writeBatch,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  where,
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
const REVIEW_UPDATE_META_KEYS = new Set([
  "__path",
  "__col",
  "productId",
  "userId",
  "uid",
  "id",
]);

const sanitizeReviewUpdatePayload = (data = {}) => {
  return Object.fromEntries(
    Object.entries(data).filter(
      ([key, value]) => value !== undefined && !REVIEW_UPDATE_META_KEYS.has(key)
    )
  );
};

const getCollectionDocsSafe = async (colName) => {
  try {
    const ordered = await getDocs(
      query(collection(db, colName), orderBy("createdAt", "desc"))
    );
    return ordered.docs.map((d) => ({ id: d.id, __col: colName, ...d.data() }));
  } catch {
    try {
      const snap = await getDocs(collection(db, colName));
      return snap.docs.map((d) => ({ id: d.id, __col: colName, ...d.data() }));
    } catch {
      // Collection may be blocked by rules in this project; treat as optional.
      return [];
    }
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

const normalizeReview = (review) => {
  const status = String(
    review.status || (review.approved === true ? "approved" : "pending")
  ).toLowerCase();
  const approved = status === "approved" || review.approved === true;
  return {
    ...review,
    status,
    approved,
    visibility: approved ? "global" : "author_only",
    userPhone:
      review.userPhone ||
      review.phone ||
      review.user?.phone ||
      "",
    userName:
      review.userName ||
      review.user?.name ||
      review.name ||
      "Anonymous",
    userEmail:
      review.userEmail ||
      review.email ||
      review.user?.email ||
      "",
    productName:
      review.productName ||
      review.product?.name ||
      "Product review",
  };
};

const reviewMirrorId = (productId, userId, fallbackId = "") => {
  const p = String(productId || "").trim();
  const u = String(userId || "").trim();
  if (p && u) return `${p}_${u}`;
  return String(fallbackId || "").trim();
};

const reviewDocRef = (id, collectionName = "productReviews", extra = {}) => {
  const fullPath = (extra.__path || "").toString().trim();
  if (fullPath) {
    return doc(db, fullPath);
  }

  const productId = (extra.productId || "").toString().trim();
  const userId = (extra.userId || "").toString().trim();
  if (collectionName === "products_reviews" && productId && userId) {
    return doc(db, "products", productId, "reviews", userId);
  }

  return doc(db, collectionName, id);
};

const getReviewSyncTargets = (id, collectionName = "productReviews", extra = {}) => {
  const targets = [];
  const primary = reviewDocRef(id, collectionName, extra);
  targets.push(primary);

  const productId = String(extra.productId || "").trim();
  const userId = String(extra.userId || id || "").trim();
  if (productId && userId) {
    const subPath = doc(db, "products", productId, "reviews", userId);
    const mirrorPath = doc(db, "productReviews", reviewMirrorId(productId, userId, id));
    if (subPath.path !== primary.path) targets.push(subPath);
    if (mirrorPath.path !== primary.path && mirrorPath.path !== subPath.path) {
      targets.push(mirrorPath);
    }
  }

  const unique = new Map();
  targets.forEach((ref) => unique.set(ref.path, ref));
  return Array.from(unique.values());
};

export const getProductReviews = async () => {
  const [legacyLists, subCollectionList] = await Promise.all([
    Promise.all(REVIEW_COLLECTIONS.map((name) => getCollectionDocsSafe(name))),
    (async () => {
      try {
        const snap = await getDocs(collectionGroup(db, "reviews"));
        return snap.docs.map((d) => {
          const parentProductRef = d.ref.parent.parent;
          return {
            id: d.id,
            __col: "products_reviews",
            __path: d.ref.path,
            productId: parentProductRef?.id || "",
            userId: d.id,
            ...d.data(),
          };
        });
      } catch {
        // Fallback for restricted/non-admin users: only globally visible reviews.
        try {
          const approvedByStatusSnap = await getDocs(
            query(collectionGroup(db, "reviews"), where("status", "==", "approved"))
          );
          const approvedByFlagSnap = await getDocs(
            query(collectionGroup(db, "reviews"), where("approved", "==", true))
          );

          const mapped = [...approvedByStatusSnap.docs, ...approvedByFlagSnap.docs].map((d) => {
              const parentProductRef = d.ref.parent.parent;
              return {
                id: d.id,
                __col: "products_reviews",
                __path: d.ref.path,
                productId: parentProductRef?.id || "",
                userId: d.id,
                ...d.data(),
              };
            });

          const uniqueByPath = new Map();
          mapped.forEach((item) => uniqueByPath.set(item.__path || `${item.__col}-${item.id}`, item));
          return Array.from(uniqueByPath.values());
        } catch {
          return [];
        }
      }
    })(),
  ]);

  const merged = [...legacyLists.flat(), ...subCollectionList].map(normalizeReview);
  const uniqueReviews = new Map();
  merged.forEach((item) => {
    const key = reviewMirrorId(item.productId, item.userId || item.uid || item.id, item.__path || item.id);
    uniqueReviews.set(key, item);
  });
  const deduped = Array.from(uniqueReviews.values());
  deduped.sort((a, b) => {
    const bTime = toMillis(b.createdAt) || toMillis(b.submittedAt);
    const aTime = toMillis(a.createdAt) || toMillis(a.submittedAt);
    return bTime - aTime;
  });
  return deduped;
};

export const addProductReview = async (data) => {
  const normalized = {
    ...data,
    approved: Boolean(data.approved),
    status: data.approved ? "approved" : "pending",
    visibility: data.approved ? "global" : "author_only",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const productId = String(data.productId || "").trim();
  const userId = String(data.userId || "").trim();
  if (productId && userId) {
    await setDoc(doc(db, "products", productId, "reviews", userId), normalized, {
      merge: true,
    });
    return { id: userId };
  }

  return await addDoc(collection(db, "productReviews"), normalized);
};

export const approveProductReview = async (id, extra = {}, collectionName = "productReviews") => {
  const payload = sanitizeReviewUpdatePayload({
    approved: true,
    status: "approved",
    visibility: "global",
    approvedAt: serverTimestamp(),
    ...extra,
    updatedAt: serverTimestamp(),
  });
  const targets = getReviewSyncTargets(id, collectionName, extra);
  const results = await Promise.allSettled(
    targets.map((target) => updateDoc(target, payload))
  );
  const successCount = results.filter((r) => r.status === "fulfilled").length;
  if (successCount === 0) {
    throw new Error("Could not update review status in any target path");
  }
};

export const setProductReviewStatus = async (
  id,
  status,
  extra = {},
  collectionName = "productReviews"
) => {
  const approved = status === "approved";
  const payload = sanitizeReviewUpdatePayload({
    status,
    approved,
    visibility: approved ? "global" : "author_only",
    ...(approved ? { approvedAt: serverTimestamp() } : {}),
    ...extra,
    updatedAt: serverTimestamp(),
  });
  const targets = getReviewSyncTargets(id, collectionName, extra);
  const results = await Promise.allSettled(
    targets.map((target) => updateDoc(target, payload))
  );
  const successCount = results.filter((r) => r.status === "fulfilled").length;
  if (successCount === 0) {
    const reasons = results
      .filter((r) => r.status === "rejected")
      .map((r) => {
        const reason = r.reason;
        const code = reason?.code ? `[${reason.code}] ` : "";
        return `${code}${reason?.message || "unknown error"}`;
      })
      .join(" | ");
    throw new Error(
      `Could not update review status in any target path. ${reasons}`
    );
  }
};

export const deleteProductReview = async (
  id,
  extra = {},
  collectionName = "productReviews"
) => {
  const targets = getReviewSyncTargets(id, collectionName, extra);
  const results = await Promise.allSettled(targets.map((target) => deleteDoc(target)));
  const successCount = results.filter((r) => r.status === "fulfilled").length;
  if (successCount === 0) {
    throw new Error("Could not delete review from any target path");
  }
};

// ─── Orders ──────────────────────────────────────────────────────────────────
export const getOrders = async () => {
  try {
    const snap = await getDocs(
      query(collection(db, "orders"), orderBy("createdAt", "desc"))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(db, "orders"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
};

export const addOrder = (data) => addItem("orders", data);
export const updateOrder = (id, data) => updateItem("orders", id, data);
export const deleteOrder = (id) => deleteItem("orders", id);

// ─── Notifications ───────────────────────────────────────────────────────────
export const getNotifications = async () => {
  try {
    const snap = await getDocs(
      query(collection(db, "notifications"), orderBy("createdAt", "desc"))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(db, "notifications"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
};

export const createOrderNotification = async ({
  order,
  status,
  title,
  message,
  sendSms,
  sendWhatsapp,
  createdBy,
}) => {
  const payload = {
    orderId: order.id,
    orderRef: order.orderId || order.code || order.number || order.id,
    userId: order.userId || order.customerId || order.customer?.id || "",
    customerName:
      order.customerName || order.customer?.name || order.userName || "Unknown Customer",
    customerEmail:
      order.customerEmail || order.customer?.email || order.email || "",
    phone:
      order.phone ||
      order.customerPhone ||
      order.customer?.phone ||
      order.userPhone ||
      "",
    status,
    title,
    message,
    type: "order_status",
    channels: {
      app: true,
      sms: Boolean(sendSms),
      whatsapp: Boolean(sendWhatsapp),
    },
    sentAt: serverTimestamp(),
    createdBy: createdBy || "admin",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const notifRef = await addDoc(collection(db, "notifications"), payload);

  if (sendSms && payload.phone) {
    await addDoc(collection(db, "smsQueue"), {
      notificationId: notifRef.id,
      userId: payload.userId || "",
      phone: payload.phone,
      message,
      status: "pending",
      source: "dashboard_notifications",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  if (sendWhatsapp && payload.phone) {
    await addDoc(collection(db, "whatsappQueue"), {
      notificationId: notifRef.id,
      userId: payload.userId || "",
      phone: payload.phone,
      message,
      status: "pending",
      source: "dashboard_notifications",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return notifRef;
};

export const getUsers = async () => {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export const createBroadcastNotification = async ({
  title,
  message,
  type,
  users,
  sendApp,
  sendWhatsapp,
  createdBy,
}) => {
  const payload = {
    title,
    message,
    type,
    audience: "all_users",
    userCount: users.length,
    channels: {
      app: Boolean(sendApp),
      whatsapp: Boolean(sendWhatsapp),
    },
    sentAt: serverTimestamp(),
    createdBy: createdBy || "admin",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const notifRef = await addDoc(collection(db, "notifications"), payload);

  if (sendApp && users.length) {
    const groups = chunk(users, 350);
    for (const group of groups) {
      const batch = writeBatch(db);
      group.forEach((user) => {
        const ref = doc(collection(db, "userNotifications"));
        batch.set(ref, {
          notificationId: notifRef.id,
          userId: user.uid || user.id,
          title,
          message,
          type,
          read: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
  }

  if (sendWhatsapp && users.length) {
    const phoneUsers = users.filter((u) => u.phone || u.mobile || u.phoneNumber);
    const groups = chunk(phoneUsers, 350);

    for (const group of groups) {
      const batch = writeBatch(db);
      group.forEach((user) => {
        const ref = doc(collection(db, "whatsappQueue"));
        batch.set(ref, {
          notificationId: notifRef.id,
          userId: user.uid || user.id,
          phone: user.phone || user.mobile || user.phoneNumber,
          message,
          status: "pending",
          source: "dashboard_broadcast",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
  }

  return notifRef;
};

// ─── Admins ───────────────────────────────────────────────────────────────────
export const getAdmins = () => getAll("admins");
export const addAdmin = (data) => addItem("admins", {
  ...data,
  active: Boolean(data.active),
  role: data.role || "admin",
});
export const updateAdmin = (id, data) => updateItem("admins", id, {
  ...data,
  active: Boolean(data.active),
});
export const deleteAdmin = (id) => deleteItem("admins", id);
export const toggleAdminStatus = (id, active) => updateAdmin(id, { active: !active });

// ─── Roles & Permissions ─────────────────────────────────────────────────────
const roleDocId = (roleName) =>
  String(roleName || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export const getRolePermissions = async (roleName) => {
  const ref = doc(db, "rolePermissions", roleDocId(roleName));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

export const saveRolePermissions = async (roleName, permissions) => {
  const ref = doc(db, "rolePermissions", roleDocId(roleName));
  const snap = await getDoc(ref);

  await setDoc(
    ref,
    {
      role: roleName,
      permissions,
      updatedAt: serverTimestamp(),
      ...(snap.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );
};
