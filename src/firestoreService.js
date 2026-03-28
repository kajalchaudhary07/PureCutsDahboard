import {
  collection,
  collectionGroup,
  getDocs,
  getDoc,
  getCountFromServer,
  addDoc,
  setDoc,
  writeBatch,
  updateDoc,
  deleteDoc,
  doc,
  documentId,
  serverTimestamp,
  query,
  orderBy,
  startAfter,
  limit,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebaseConfig";

// ─── Generic helpers ───────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const clampPageSize = (value, fallback = DEFAULT_PAGE_SIZE) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(parsed)));
};

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
export const getProductsPaginated = async ({
  pageSize = DEFAULT_PAGE_SIZE,
  cursor = null,
} = {}) => {
  const pageLimit = clampPageSize(pageSize);

  if (cursor?.__fallbackOffset !== undefined) {
    const allRows = await getProducts();
    const offset = Number(cursor.__fallbackOffset || 0);
    const rows = allRows.slice(offset, offset + pageLimit);
    const nextOffset = offset + rows.length;
    return {
      rows,
      nextCursor: nextOffset < allRows.length ? { __fallbackOffset: nextOffset } : null,
      hasMore: nextOffset < allRows.length,
    };
  }

  let builtQuery = query(
    collection(db, "products"),
    orderBy("createdAt", "desc"),
    limit(pageLimit)
  );

  if (cursor) {
    builtQuery = query(
      collection(db, "products"),
      orderBy("createdAt", "desc"),
      startAfter(cursor),
      limit(pageLimit)
    );
  }

  try {
    const snap = await getDocs(builtQuery);
    return {
      rows: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
      nextCursor: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
      hasMore: snap.docs.length === pageLimit,
    };
  } catch {
    const allRows = await getProducts();
    const offset = Number(cursor?.__fallbackOffset || 0);
    const rows = allRows.slice(offset, offset + pageLimit);
    const nextOffset = offset + rows.length;
    return {
      rows,
      nextCursor: nextOffset < allRows.length ? { __fallbackOffset: nextOffset } : null,
      hasMore: nextOffset < allRows.length,
    };
  }
};
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

export const deleteAllProductVariants = async (productId) => {
  const snap = await getDocs(collection(db, "products", productId, "variants"));
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((variantDoc) => {
    batch.delete(doc(db, "products", productId, "variants", variantDoc.id));
  });
  await batch.commit();
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

// ─── Sub-Sub-Categories ───────────────────────────────────────────────────────
export const getSubSubCategories = () => getAll("subSubCategories");
export const addSubSubCategory = (data) => addItem("subSubCategories", data);
export const updateSubSubCategory = (id, data) =>
  updateItem("subSubCategories", id, data);
export const deleteSubSubCategory = (id) => deleteItem("subSubCategories", id);

// ─── Banners ─────────────────────────────────────────────────────────────────
const toMillisSafe = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
};

const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm|ogv|m3u8)(\?|#|$)/i;

const isVideoLike = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return false;
  if (raw.startsWith("data:video/")) return true;
  return VIDEO_EXT_RE.test(raw);
};

const inferBannerMediaType = (raw = {}) => {
  const explicit = String(raw.mediaType || "").trim().toLowerCase();
  if (explicit === "video" || explicit === "image") return explicit;
  return isVideoLike(raw.mediaUrl || raw.video || raw.image || raw.imageUrl)
    ? "video"
    : "image";
};

const normalizeBanner = (raw = {}) => {
  const mediaUrl = String(
    raw.mediaUrl || raw.video || raw.image || raw.imageUrl || ""
  ).trim();
  const mediaType = inferBannerMediaType(raw);

  return {
    ...raw,
    title: String(raw.title || "").trim(),
    mediaUrl,
    mediaType,
    image: mediaUrl,
    link: String(raw.link || "/products").trim() || "/products",
    active: raw.active !== false,
  };
};

export const getBanners = async () => {
  let rows = [];
  try {
    const snap = await getDocs(
      query(collection(db, "banners"), orderBy("createdAt", "desc"))
    );
    rows = snap.docs.map((d) => normalizeBanner({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(db, "banners"));
    rows = snap.docs.map((d) => normalizeBanner({ id: d.id, ...d.data() }));
    rows.sort(
      (a, b) =>
        toMillisSafe(b.createdAt || b.updatedAt) -
        toMillisSafe(a.createdAt || a.updatedAt)
    );
  }
  return rows;
};

export const addBanner = (data) =>
  addItem("banners", {
    ...normalizeBanner(data),
  });

export const updateBanner = (id, data) =>
  updateItem("banners", id, {
    ...data,
    ...(data.title !== undefined ? { title: String(data.title || "").trim() } : {}),
    ...(data.image !== undefined || data.mediaUrl !== undefined
      ? {
          mediaUrl: String(data.mediaUrl ?? data.image ?? "").trim(),
          image: String(data.mediaUrl ?? data.image ?? "").trim(),
          mediaType: inferBannerMediaType(data),
        }
      : {}),
    ...(data.link !== undefined
      ? { link: String(data.link || "/products").trim() || "/products" }
      : {}),
    ...(data.active !== undefined ? { active: data.active !== false } : {}),
  });

export const deleteBanner = (id) => deleteItem("banners", id);

export const toggleBannerStatus = (id, active) =>
  updateBanner(id, { active: !Boolean(active) });

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

export const getProductReviewsPaginated = async ({
  pageSize = DEFAULT_PAGE_SIZE,
  cursor = null,
  status = "all",
} = {}) => {
  const pageLimit = clampPageSize(pageSize);
  const normalizedStatus = String(status || "all").trim().toLowerCase();
  const includeStatusFilter =
    normalizedStatus === "approved" || normalizedStatus === "pending";

  if (cursor?.__fallbackOffset !== undefined) {
    const allRows = await getProductReviews();
    const filteredRows = includeStatusFilter
      ? allRows.filter((row) => String(row.status || "").toLowerCase() === normalizedStatus)
      : allRows;
    const offset = Number(cursor.__fallbackOffset || 0);
    const rows = filteredRows.slice(offset, offset + pageLimit);
    const nextOffset = offset + rows.length;
    return {
      rows,
      nextCursor: nextOffset < filteredRows.length ? { __fallbackOffset: nextOffset } : null,
      hasMore: nextOffset < filteredRows.length,
    };
  }

  const base = collectionGroup(db, "reviews");

  const buildQuery = (nextCursor = null) => {
    const constraints = [];
    if (includeStatusFilter) {
      constraints.push(where("status", "==", normalizedStatus));
    }
    constraints.push(orderBy("createdAt", "desc"));
    if (nextCursor) constraints.push(startAfter(nextCursor));
    constraints.push(limit(pageLimit));
    return query(base, ...constraints);
  };

  try {
    const snap = await getDocs(buildQuery(cursor));
    const rows = snap.docs.map((d) => {
      const parentProductRef = d.ref.parent.parent;
      return normalizeReview({
        id: d.id,
        __col: "products_reviews",
        __path: d.ref.path,
        productId: parentProductRef?.id || "",
        userId: d.id,
        ...d.data(),
      });
    });
    return {
      rows,
      nextCursor: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
      hasMore: snap.docs.length === pageLimit,
    };
  } catch {
    try {
      const fallbackBase = collection(db, "productReviews");
      const constraints = [];
      if (includeStatusFilter) {
        constraints.push(where("status", "==", normalizedStatus));
      }
      constraints.push(orderBy("createdAt", "desc"));
      if (cursor) constraints.push(startAfter(cursor));
      constraints.push(limit(pageLimit));
      const snap = await getDocs(query(fallbackBase, ...constraints));
      const rows = snap.docs.map((d) =>
        normalizeReview({ id: d.id, __col: "productReviews", ...d.data() })
      );
      return {
        rows,
        nextCursor: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
        hasMore: snap.docs.length === pageLimit,
      };
    } catch {
      const allRows = await getProductReviews();
      const filteredRows = includeStatusFilter
        ? allRows.filter((row) => String(row.status || "").toLowerCase() === normalizedStatus)
        : allRows;
      const offset = Number(cursor?.__fallbackOffset || 0);
      const rows = filteredRows.slice(offset, offset + pageLimit);
      const nextOffset = offset + rows.length;
      return {
        rows,
        nextCursor: nextOffset < filteredRows.length ? { __fallbackOffset: nextOffset } : null,
        hasMore: nextOffset < filteredRows.length,
      };
    }
  }
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
const normalizeOrder = (raw = {}) => {
  const items = Array.isArray(raw.items) ? raw.items : [];
  const normalizedItems = items.map((item, index) => {
    const productId = String(item?.productId || item?.id || "").trim();
    const quantity = Number(item?.quantity ?? item?.qty ?? 1) || 1;
    return {
      ...item,
      productId,
      quantity,
      orderItemId:
        item?.orderItemId ||
        `${String(raw.orderId || raw.orderRef || raw.id || "ORDER")}-I${String(index + 1).padStart(2, "0")}`,
    };
  });

  const derivedOrderRef =
    raw.orderId ||
    raw.orderRef ||
    raw.orderNumber ||
    raw.code ||
    raw.number ||
    raw.id ||
    "";

  const totalItems =
    Number(raw.totalItems) ||
    normalizedItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const itemCount =
    Number(raw.itemCount) || Number(raw.itemsCount) || normalizedItems.length;

  const amount = Number(
    raw.amount ?? raw.total ?? raw.totalAmount ?? raw.grandTotal ?? raw.payableAmount ?? 0
  );

  const orderStatus = String(raw.orderStatus || raw.status || "placed")
    .trim()
    .toLowerCase();

  const paymentStatus = String(raw.paymentStatus || "pending")
    .trim()
    .toLowerCase();

  const paymentMethod = String(
    raw.paymentMethod || raw.paymentMode || raw.billDetails?.paymentMethod || "cod"
  )
    .trim()
    .toLowerCase();

  return {
    ...raw,
    items: normalizedItems,
    orderId: derivedOrderRef,
    orderRef: derivedOrderRef,
    orderNumber: raw.orderNumber || derivedOrderRef,
    itemCount,
    itemsCount: itemCount,
    totalItems,
    amount,
    total: Number(raw.total ?? amount),
    totalAmount: Number(raw.totalAmount ?? amount),
    grandTotal: Number(raw.grandTotal ?? amount),
    orderStatus,
    status: orderStatus,
    paymentStatus,
    paymentMethod,
    paymentMode: paymentMethod,
  };
};

const resolveOrderOwnerId = (order = {}) => {
  const candidates = [
    order.userId,
    order.uid,
    order.customerId,
    order.userUid,
    order.user?.id,
    order.user?.uid,
    order.customer?.id,
    order.customer?.uid,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }
  return "";
};

const hydrateOrdersWithCustomerProfile = async (orders) => {
  const ownerIds = Array.from(
    new Set(
      orders
        .map((order) => resolveOrderOwnerId(order))
        .filter((id) => id)
    )
  );

  if (ownerIds.length === 0) {
    return orders.map((order) => normalizeOrder(order));
  }

  const userEntries = await Promise.all(
    ownerIds.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (!snap.exists()) return [uid, null];
        return [uid, snap.data()];
      } catch {
        return [uid, null];
      }
    })
  );

  const userMap = Object.fromEntries(userEntries);

  return orders.map((order) => {
    const ownerId = resolveOrderOwnerId(order);
    const profile = userMap[ownerId] || {};

    const fallbackDeliveryDetails = profile.deliveryDetails || null;
    const fallbackDeliveryAddress =
      profile.deliveryAddressDetails || fallbackDeliveryDetails?.deliveryAddress || null;
    const fallbackContactDetails =
      profile.contactDetails || fallbackDeliveryDetails?.contactDetails || null;

    const enriched = {
      ...order,
      customerName:
        order.customerName ||
        order.customer?.name ||
        order.userName ||
        profile.name ||
        profile.ownerName ||
        "",
      customerEmail:
        order.customerEmail ||
        order.customer?.email ||
        order.email ||
        profile.email ||
        "",
      customerPhone:
        order.customerPhone ||
        order.phone ||
        profile.phone ||
        profile.mobile ||
        "",
      phone:
        order.phone ||
        order.customerPhone ||
        profile.phone ||
        profile.mobile ||
        "",
      contactDetails:
        order.contactDetails ||
        (fallbackContactDetails
          ? {
              receiverName:
                fallbackContactDetails.receiverName ||
                profile.ownerName ||
                profile.name ||
                "",
              phone:
                fallbackContactDetails.phone ||
                profile.phone ||
                profile.mobile ||
                "",
            }
          : {
              receiverName:
                order.customerName || profile.ownerName || profile.name || "",
              phone:
                order.customerPhone ||
                order.phone ||
                profile.phone ||
                profile.mobile ||
                "",
            }),
      deliveryDetails: order.deliveryDetails || fallbackDeliveryDetails || null,
      deliveryPlaced:
        typeof order.deliveryPlaced === "boolean"
          ? order.deliveryPlaced
          : Boolean(order.deliveryDetails?.deliveryPlaced ?? fallbackDeliveryDetails?.deliveryPlaced ?? false),
      deliveryAddress:
        order.deliveryAddress ||
        order.shippingAddress ||
        order.customer?.address ||
        fallbackDeliveryAddress ||
        null,
    };

    return normalizeOrder(enriched);
  });
};

export const getOrdersPaginated = async ({ pageSize = DEFAULT_PAGE_SIZE, cursor = null } = {}) => {
  const pageLimit = clampPageSize(pageSize);
  let builtQuery = query(
    collection(db, "orders"),
    orderBy("createdAt", "desc"),
    limit(pageLimit)
  );

  if (cursor) {
    builtQuery = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc"),
      startAfter(cursor),
      limit(pageLimit)
    );
  }

  const snap = await getDocs(builtQuery);
  const rawOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const rows = await hydrateOrdersWithCustomerProfile(rawOrders);
  const nextCursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

  return {
    rows,
    nextCursor,
    hasMore: snap.docs.length === pageLimit,
  };
};

export const getOrders = async () => {
  try {
    const snap = await getDocs(
      query(collection(db, "orders"), orderBy("createdAt", "desc"))
    );
    const rawOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return await hydrateOrdersWithCustomerProfile(rawOrders);
  } catch {
    const snap = await getDocs(collection(db, "orders"));
    const rawOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return await hydrateOrdersWithCustomerProfile(rawOrders);
  }
};

export const getOrderById = async (id) => {
  const orderId = String(id || "").trim();
  if (!orderId) throw new Error("Order id is required");

  const snap = await getDoc(doc(db, "orders", orderId));
  if (!snap.exists()) return null;

  const [hydrated] = await hydrateOrdersWithCustomerProfile([
    { id: snap.id, ...snap.data() },
  ]);

  return hydrated || null;
};

export const addOrder = (data) => addItem("orders", data);
export const updateOrder = (id, data) => updateItem("orders", id, data);
export const deleteOrder = (id) => deleteItem("orders", id);

// ─── Notifications ───────────────────────────────────────────────────────────
const normalizeNotification = (raw = {}) => {
  const targetType = String(raw.targetType || raw.audience || "")
    .trim()
    .toLowerCase();
  const channels = raw.channels || {};

  return {
    ...raw,
    targetType,
    orderRef: raw.orderRef || raw.orderId || "",
    type:
      raw.type ||
      (targetType === "all" || raw.audience === "all_users"
        ? "broadcast"
        : "order_status"),
    audience:
      raw.audience ||
      (targetType === "all" ? "all_users" : "specific_user"),
    customerName: raw.customerName || raw.userName || "",
    channels: {
      app: Boolean(channels.app ?? channels.push),
      push: Boolean(channels.push ?? channels.app),
      sms: Boolean(channels.sms),
      whatsapp: Boolean(channels.whatsapp),
    },
  };
};

const callSendNotification = async (payload) => {
  const call = httpsCallable(functions, "sendNotification");
  const res = await call(payload);
  return res?.data || null;
};

const shouldFallbackToLegacyNotification = (error) => {
  const code = String(error?.code || "").toLowerCase();
  const msg = String(error?.message || "").toLowerCase();

  return (
    code.includes("not-found") ||
    code.includes("unavailable") ||
    code.includes("internal") ||
    msg.includes("sendnotification") ||
    msg.includes("function")
  );
};

const legacyCreateOrderNotification = async ({
  order,
  status,
  title,
  message,
  sendApp,
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
    targetType: "specific",
    channels: {
      app: Boolean(sendApp),
      push: Boolean(sendApp),
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
      source: "dashboard_notifications_legacy_fallback",
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
      source: "dashboard_notifications_legacy_fallback",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return { success: true, pushSent: Boolean(sendApp) ? 1 : 0, fallback: true };
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const legacyCreateBroadcastNotification = async ({
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
    type: type || "broadcast",
    targetType: "all",
    audience: "all_users",
    userCount: (users || []).length,
    channels: {
      app: Boolean(sendApp),
      push: Boolean(sendApp),
      whatsapp: Boolean(sendWhatsapp),
      sms: false,
    },
    sentAt: serverTimestamp(),
    createdBy: createdBy || "admin",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const notifRef = await addDoc(collection(db, "notifications"), payload);

  if (sendApp && (users || []).length) {
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

  if (sendWhatsapp && (users || []).length) {
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
          source: "dashboard_broadcast_legacy_fallback",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
  }

  return { success: true, pushSent: Boolean(sendApp) ? 1 : 0, fallback: true };
};

export const getNotifications = async () => {
  try {
    const snap = await getDocs(
      query(collection(db, "notifications"), orderBy("createdAt", "desc"))
    );
    return snap.docs.map((d) => normalizeNotification({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(db, "notifications"));
    return snap.docs.map((d) => normalizeNotification({ id: d.id, ...d.data() }));
  }
};

export const getNotificationsPaginated = async ({
  pageSize = DEFAULT_PAGE_SIZE,
  cursor = null,
} = {}) => {
  const pageLimit = clampPageSize(pageSize);
  let builtQuery = query(
    collection(db, "notifications"),
    orderBy("createdAt", "desc"),
    limit(pageLimit)
  );

  if (cursor) {
    builtQuery = query(
      collection(db, "notifications"),
      orderBy("createdAt", "desc"),
      startAfter(cursor),
      limit(pageLimit)
    );
  }

  try {
    const snap = await getDocs(builtQuery);
    const rows = snap.docs.map((d) => normalizeNotification({ id: d.id, ...d.data() }));
    return {
      rows,
      nextCursor: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
      hasMore: snap.docs.length === pageLimit,
    };
  } catch {
    const allRows = await getNotifications();
    const offset = Number(cursor?.__fallbackOffset || 0);
    const rows = allRows.slice(offset, offset + pageLimit);
    const nextOffset = offset + rows.length;
    return {
      rows,
      nextCursor: nextOffset < allRows.length ? { __fallbackOffset: nextOffset } : null,
      hasMore: nextOffset < allRows.length,
    };
  }
};

export const deleteNotification = async (id) => {
  const notificationId = String(id || "").trim();
  if (!notificationId) {
    throw new Error("Notification id is required");
  }

  await deleteItem("notifications", notificationId);
};

export const createOrderNotification = async ({
  order,
  status,
  title,
  message,
  sendApp = true,
  sendSms,
  sendWhatsapp,
  createdBy,
}) => {
  const orderId = String(order?.id || "").trim();
  if (!orderId) {
    throw new Error("Valid order id is required for order notification");
  }

  try {
    return await callSendNotification({
      targetType: "specific",
      orderId,
      title,
      message,
      type: status ? "order_status" : "custom",
      channels: {
        push: Boolean(sendApp),
        whatsapp: Boolean(sendWhatsapp),
        sms: Boolean(sendSms),
      },
      createdBy,
    });
  } catch (error) {
    if (Boolean(sendApp)) {
      throw new Error(
        "Live push service is unavailable right now. Please retry in a moment."
      );
    }

    if (!shouldFallbackToLegacyNotification(error)) {
      throw error;
    }

    return await legacyCreateOrderNotification({
      order,
      status,
      title,
      message,
      sendApp,
      sendSms,
      sendWhatsapp,
      createdBy,
    });
  }
};

export const getUsers = async () => {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getUsersPaginated = async ({ pageSize = DEFAULT_PAGE_SIZE, cursor = null } = {}) => {
  const pageLimit = clampPageSize(pageSize);
  let builtQuery = query(
    collection(db, "users"),
    orderBy(documentId()),
    limit(pageLimit)
  );

  if (cursor) {
    builtQuery = query(
      collection(db, "users"),
      orderBy(documentId()),
      startAfter(cursor),
      limit(pageLimit)
    );
  }

  const snap = await getDocs(builtQuery);
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const nextCursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

  return {
    rows,
    nextCursor,
    hasMore: snap.docs.length === pageLimit,
  };
};

export const updateUser = (id, data) => updateItem("users", id, data);
export const deleteUser = (id) => deleteItem("users", id);

// ─── Customers (Users with Orders) ─────────────────────────────────────────────

const resolveOrderUserId = (order = {}) => {
  const direct = [
    order.userId,
    order.uid,
    order.customerId,
    order.userUid,
    order.user?.id,
    order.user?.uid,
    order.customer?.id,
    order.customer?.uid,
  ];

  for (const candidate of direct) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }
  return "";
};

const orderCountCache = new Map();

const getOrderCountByField = async (field, userId) => {
  const uid = String(userId || "").trim();
  if (!uid) return 0;

  try {
    const snap = await getCountFromServer(
      query(collection(db, "orders"), where(field, "==", uid))
    );
    return Number(snap?.data()?.count || 0);
  } catch {
    return 0;
  }
};

const getUserOrderCount = async (userId) => {
  const uid = String(userId || "").trim();
  if (!uid) return 0;
  if (orderCountCache.has(uid)) return orderCountCache.get(uid);

  const fieldsByPriority = ["userId", "uid", "customerId", "userUid"];
  for (const field of fieldsByPriority) {
    const count = await getOrderCountByField(field, uid);
    if (count > 0) {
      orderCountCache.set(uid, count);
      return count;
    }
  }

  orderCountCache.set(uid, 0);
  return 0;
};

/**
 * Fetches only customers who have placed at least one order
 * Automatically excludes admin/staff users (they won't have orders)
 * Returns users with accurate order counts
 */
export const getUsersWithOrderCounts = async () => {
  // Fetch all orders from the orders collection
  const ordersSnap = await getDocs(collection(db, "orders"));
  const allOrders = ordersSnap.docs.map((d) => d.data());
  
  // Extract unique user IDs from orders (only customers who have ordered)
  const orderingUserIds = new Set(
    allOrders
      .map((order) => resolveOrderUserId(order))
      .filter((userId) => userId && typeof userId === "string" && userId.trim())
  );

  if (orderingUserIds.size === 0) {
    return [];
  }

  // Fetch all users
  const usersSnap = await getDocs(collection(db, "users"));
  const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Build order count map in one pass
  const orderCountMap = {};
  allOrders.forEach((order) => {
    const userId = resolveOrderUserId(order);
    if (userId) {
      orderCountMap[userId] = (orderCountMap[userId] || 0) + 1;
    }
  });

  // Filter to only users who have ordered and attach their order counts
  const customersWithOrders = allUsers
    .filter((user) => orderingUserIds.has(user.id || user.uid))
    .map((user) => ({
      ...user,
      ordersCount: orderCountMap[user.id || user.uid] || 0,
    }));

  return customersWithOrders;
};

const legacyGetUsersWithOrderCountsPaginated = async ({
  pageSize = DEFAULT_PAGE_SIZE,
  cursor = null,
  overscanFactor = 3,
} = {}) => {
  const targetSize = clampPageSize(pageSize);
  const overscanSize = clampPageSize(targetSize * Math.max(1, Number(overscanFactor) || 1), targetSize);
  const customers = [];
  let currentCursor = cursor;
  let hasMoreUsers = true;
  let loops = 0;

  while (customers.length < targetSize && hasMoreUsers && loops < 10) {
    loops += 1;
    const page = await getUsersPaginated({
      pageSize: overscanSize,
      cursor: currentCursor,
    });

    hasMoreUsers = Boolean(page.hasMore);
    currentCursor = page.nextCursor;

    if (!page.rows.length) break;

    const withCounts = await Promise.all(
      page.rows.map(async (user) => {
        const userKey = user.id || user.uid;
        if (!userKey) return null;
        const ordersCount = await getUserOrderCount(userKey);
        if (ordersCount <= 0) return null;
        return {
          ...user,
          ordersCount,
        };
      })
    );

    customers.push(...withCounts.filter(Boolean));
    if (!hasMoreUsers) break;
  }

  return {
    rows: customers.slice(0, targetSize),
    nextCursor: hasMoreUsers ? currentCursor : null,
    hasMore: hasMoreUsers,
  };
};

export const getUsersWithOrderCountsPaginated = async ({
  pageSize = DEFAULT_PAGE_SIZE,
  cursor = null,
  overscanFactor = 3,
} = {}) => {
  const pageLimit = clampPageSize(pageSize);

  if (cursor?.__fallbackOffset !== undefined) {
    return legacyGetUsersWithOrderCountsPaginated({
      pageSize,
      cursor,
      overscanFactor,
    });
  }

  try {
    let builtQuery = query(
      collection(db, "users"),
      where("ordersCount", ">", 0),
      orderBy("ordersCount", "desc"),
      limit(pageLimit)
    );

    if (cursor) {
      builtQuery = query(
        collection(db, "users"),
        where("ordersCount", ">", 0),
        orderBy("ordersCount", "desc"),
        startAfter(cursor),
        limit(pageLimit)
      );
    }

    const snap = await getDocs(builtQuery);
    const rows = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        ...data,
        ordersCount: Number(data.ordersCount || 0),
      };
    });

    if (!cursor && rows.length === 0) {
      const ordersTotal = await getSafeCount(collection(db, "orders"));
      if (ordersTotal > 0) {
        return legacyGetUsersWithOrderCountsPaginated({
          pageSize,
          cursor,
          overscanFactor,
        });
      }
    }

    return {
      rows,
      nextCursor: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
      hasMore: snap.docs.length === pageLimit,
    };
  } catch {
    return legacyGetUsersWithOrderCountsPaginated({
      pageSize,
      cursor,
      overscanFactor,
    });
  }
};

const getSafeCount = async (ref) => {
  try {
    const snap = await getCountFromServer(ref);
    return Number(snap?.data()?.count || 0);
  } catch {
    return 0;
  }
};

const getApprovedReviewsCount = async () => {
  const subCollectionApproved = await getSafeCount(
    query(collectionGroup(db, "reviews"), where("approved", "==", true))
  );
  if (subCollectionApproved > 0) return subCollectionApproved;

  return await getSafeCount(
    query(collection(db, "productReviews"), where("approved", "==", true))
  );
};

export const getDashboardMetrics = async ({ recentOrdersPageSize = 80 } = {}) => {
  let snapshot = null;
  try {
    const call = httpsCallable(functions, "getDashboardMetricsSnapshot");
    const response = await call({});
    snapshot = response?.data || null;
  } catch {
    snapshot = null;
  }

  const [fallbackProductsCount, fallbackCustomersCount, fallbackApprovedReviews] = await Promise.all([
    getSafeCount(collection(db, "products")),
    getSafeCount(collection(db, "users")),
    getApprovedReviewsCount(),
  ]);

  let fallbackOrdersCount = Number(snapshot?.ordersCount || 0);
  let fallbackTotalRevenue = Number(snapshot?.totalRevenue || 0);
  let fallbackPendingOrders = Number(snapshot?.pendingOrders || 0);
  let recentOrders = [];

  if (snapshot) {
    const page = await getOrdersPaginated({
      pageSize: clampPageSize(recentOrdersPageSize, 80),
    });
    recentOrders = page.rows;
  } else {
    const allOrders = await getOrders();
    fallbackOrdersCount = allOrders.length;
    fallbackTotalRevenue = allOrders.reduce((sum, order) => {
      const amount = Number(
        order.totalAmount ?? order.total ?? order.grandTotal ?? order.amount ?? 0
      );
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    fallbackPendingOrders = allOrders.filter((order) => {
      const status = String(order.orderStatus || order.status || "").toLowerCase();
      return status && status !== "delivered" && status !== "cancelled";
    }).length;
    recentOrders = allOrders.slice(0, clampPageSize(recentOrdersPageSize, 80));
  }

  return {
    ordersCount: fallbackOrdersCount,
    productsCount: fallbackProductsCount,
    customersCount: fallbackCustomersCount,
    approvedReviews: fallbackApprovedReviews,
    totalRevenue: fallbackTotalRevenue,
    pendingOrders: fallbackPendingOrders,
    recentOrders,
    source: snapshot?.source || "firestore_count_fallback",
  };
};

export const rebuildOrderCounters = async () => {
  const call = httpsCallable(functions, "rebuildOrderCounters");
  const response = await call({});
  return response?.data || null;
};

export const getDashboardMetricsSnapshotMeta = async () => {
  const call = httpsCallable(functions, "getDashboardMetricsSnapshot");
  const response = await call({});
  return response?.data || null;
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
  try {
    return await callSendNotification({
      targetType: "all",
      title,
      message,
      type: type || "broadcast",
      channels: {
        push: Boolean(sendApp),
        whatsapp: Boolean(sendWhatsapp),
        sms: false,
      },
      createdBy,
    });
  } catch (error) {
    if (Boolean(sendApp)) {
      throw new Error(
        "Live push service is unavailable right now. Please retry in a moment."
      );
    }

    if (!shouldFallbackToLegacyNotification(error)) {
      throw error;
    }

    return await legacyCreateBroadcastNotification({
      title,
      message,
      type,
      users,
      sendApp,
      sendWhatsapp,
      createdBy,
    });
  }
};

// ─── Admins ───────────────────────────────────────────────────────────────────
export const getAdmins = async () => {
  const asActiveBool = (value) => value !== false;
  const normalizeRole = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[_\s-]+/g, "");

  const isAdminLikeRole = (value) => {
    const role = normalizeRole(value);
    return role === "admin" || role === "superadmin" || role === "superadmins";
  };

  const normalizeAdminRecord = (id, raw = {}) => ({
    id,
    uid: String(raw.uid || id || "").trim(),
    name: String(raw.name || "").trim(),
    email: String(raw.email || "").trim().toLowerCase(),
    phone: String(raw.phone || "").trim(),
    role: String(raw.role || "admin").trim(),
    active: asActiveBool(raw.active),
    avatar: String(raw.avatar || "").trim(),
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  });

  const adminsMap = new Map();

  // Source 0: Firebase Auth claims via callable function (most reliable for real admin status)
  try {
    const authRows = await getAdminsFromAuth();
    authRows.forEach((raw) => {
      const row = normalizeAdminRecord(raw.uid || raw.email, raw);
      const key = row.uid || row.email || row.id;
      if (key) adminsMap.set(key, row);
    });
  } catch {
    // Keep Firestore fallback sources below.
  }

  // Primary source: admins collection
  try {
    const adminSnap = await getDocs(collection(db, "admins"));
    adminSnap.docs.forEach((d) => {
      const row = normalizeAdminRecord(d.id, d.data());
      const key = row.uid || row.email || row.id;
      if (key) adminsMap.set(key, row);
    });
  } catch {
    // keep fallback path below
  }

  // Fallback/enrichment source: users collection with admin-like roles
  try {
    const roleSnap = await getDocs(collection(db, "users"));
    roleSnap.docs.forEach((d) => {
      const data = d.data() || {};
      if (!isAdminLikeRole(data.role)) return;

      const row = normalizeAdminRecord(d.id, data);
      const key = row.uid || row.email || row.id;
      if (!key) return;

      if (!adminsMap.has(key)) {
        adminsMap.set(key, row);
      } else {
        const prev = adminsMap.get(key);
        adminsMap.set(key, {
          ...prev,
          // fill missing values from users document
          name: prev.name || row.name,
          email: prev.email || row.email,
          phone: prev.phone || row.phone,
          role: prev.role || row.role,
          avatar: prev.avatar || row.avatar,
          uid: prev.uid || row.uid,
        });
      }
    });
  } catch {
    // If both sources are blocked, caller will handle with UI error.
  }

  return Array.from(adminsMap.values()).sort((a, b) => {
    const aName = String(a.name || a.email || "").toLowerCase();
    const bName = String(b.name || b.email || "").toLowerCase();
    return aName.localeCompare(bName);
  });
};
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

export const setAdminAuthClaims = async ({ uid, email, role, active, name, phone, avatar }) => {
  const call = httpsCallable(functions, "setAdminClaims");
  const result = await call({ uid, email, role, active, name, phone, avatar });
  return result?.data || null;
};

export const getAdminsFromAuth = async () => {
  const call = httpsCallable(functions, "listAdminsFromAuth");
  const result = await call({});
  return Array.isArray(result?.data?.users) ? result.data.users : [];
};

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

// ─── Support Bot Config / Leads ─────────────────────────────────────────────
const DEFAULT_SUPPORT_BOT_CONFIG = {
  enabled: true,
  steps: {
    START: {
      text: "Welcome to PureCuts Bulk Support 👋",
      options: ["Bulk Order Discount", "Product Availability", "Delivery Info"],
    },
    CATEGORY: {
      text: "Select product type:",
      options: ["Skincare", "Hair", "Equipment", "Mixed"],
    },
    BULK_INPUT: {
      text: "Please type your bulk order requirement (products, quantity, city, budget):",
      options: [],
    },
  },
};

export const getSupportBotConfig = async () => {
  const ref = doc(db, "bot_config", "support_bot");
  const snap = await getDoc(ref);
  if (!snap.exists()) return DEFAULT_SUPPORT_BOT_CONFIG;
  return {
    ...DEFAULT_SUPPORT_BOT_CONFIG,
    ...snap.data(),
    steps: {
      ...DEFAULT_SUPPORT_BOT_CONFIG.steps,
      ...(snap.data()?.steps || {}),
    },
  };
};

export const saveSupportBotConfig = async (config) => {
  const ref = doc(db, "bot_config", "support_bot");
  await setDoc(
    ref,
    {
      ...config,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const getBulkLeads = async () => {
  try {
    const snap = await getDocs(
      query(collection(db, "bulkLeads"), orderBy("timestamp", "desc"))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(db, "bulkLeads"));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => toMillis(b.timestamp) - toMillis(a.timestamp));
    return rows;
  }
};
