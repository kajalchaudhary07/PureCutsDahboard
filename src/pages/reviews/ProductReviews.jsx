import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  MdAdd,
  MdSearch,
  MdCheckCircle,
  MdImage,
  MdCloudUpload,
  MdDeleteOutline,
  MdClose,
} from "react-icons/md";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useAuth } from "../../auth/AuthProvider";
import { storage } from "../../firebaseConfig";
import {
  getProductReviewsPaginated,
  addProductReview,
  setProductReviewStatus,
  deleteProductReview,
} from "../../firestoreService";

const emptyForm = {
  productId: "",
  productName: "",
  userId: "",
  userName: "",
  userEmail: "",
  userPhone: "",
  text: "",
  rating: "5",
};

const normalizeStatus = (review) => {
  if (review.status) return String(review.status).toLowerCase();
  if (review.approved === true) return "approved";
  if (review.approved === false) return "pending";
  return "pending";
};

const getReviewDate = (review) =>
  review.createdAt || review.submittedAt || review.date || review.reviewDate;

const formatDate = (value) => {
  if (!value) return "-";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB");
};

const getReviewerName = (review) =>
  review.userName || review.user?.name || review.name || review.displayName || "Anonymous";

const getReviewText = (review) =>
  review.text || review.reviewText || review.comment || review.review || review.message || "";

const getReviewerEmail = (review) =>
  review.userEmail || review.email || review.user?.email || "-";

const getReviewerPhone = (review) =>
  review.userPhone || review.phone || review.user?.phone || "-";

const normalizeImageUrl = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("gs://")) {
    const withoutScheme = value.slice(5);
    const slashIndex = withoutScheme.indexOf("/");
    if (slashIndex <= 0 || slashIndex === withoutScheme.length - 1) return "";
    const bucket = withoutScheme.slice(0, slashIndex);
    const objectPath = withoutScheme.slice(slashIndex + 1);
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media`;
  }
  if (value.startsWith("assets/")) return "";
  return `https://firebasestorage.googleapis.com/v0/b/purecuts-11a7c.firebasestorage.app/o/${encodeURIComponent(value)}?alt=media`;
};

const getReviewImage = (review) => {
  const images = [];
  if (Array.isArray(review.images)) images.push(...review.images);
  if (Array.isArray(review.mediaUrls)) images.push(...review.mediaUrls);
  if (Array.isArray(review.media)) images.push(...review.media);
  if (Array.isArray(review.photos)) images.push(...review.photos);
  if (review.productImage) images.push(review.productImage);
  if (review.imageUrl) images.push(review.imageUrl);
  if (review.image) images.push(review.image);
  return images.map(normalizeImageUrl).find(Boolean) || "";
};

const getRating = (review) => {
  const value = Number(review.rating ?? review.stars ?? 0);
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(5, value));
};

function RatingStars({ rating }) {
  const rounded = Math.round(rating);
  return (
    <span className="review-stars" aria-label={`Rating ${rounded} out of 5`}>
      {"★★★★★".split("").map((star, idx) => (
        <span key={`${star}-${idx}`} className={idx < rounded ? "on" : "off"}>★</span>
      ))}
    </span>
  );
}

export default function ProductReviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const mediaInputRef = useRef(null);

  const load = async ({ append = false } = {}) => {
    if (append) {
      if (!hasMore || loadingMore) return;
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const page = await getProductReviewsPaginated({
        pageSize: 40,
        cursor: append ? nextCursor : null,
      });
      setReviews((prev) => (append ? [...prev, ...page.rows] : page.rows));
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      toast.error("Failed to load reviews");
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter((review) => {
      const name = getReviewerName(review).toLowerCase();
      const text = getReviewText(review).toLowerCase();
      const productName = String(review.productName || review.product?.name || "").toLowerCase();
      const email = String(getReviewerEmail(review)).toLowerCase();
      const phone = String(getReviewerPhone(review)).toLowerCase();
      return (
        name.includes(q) ||
        text.includes(q) ||
        productName.includes(q) ||
        email.includes(q) ||
        phone.includes(q)
      );
    });
  }, [reviews, search]);

  const toggleApprove = async (review) => {
    const isApproved = normalizeStatus(review) === "approved";
    const nextStatus = isApproved ? "pending" : "approved";
    try {
      await setProductReviewStatus(
        review.id,
        nextStatus,
        {
          productId: review.productId,
          userId: review.userId || review.uid || review.id,
          __path: review.__path,
          moderatedBy: user?.email || "admin",
        },
        review.__col || "productReviews"
      );
      toast.success(`Review marked as ${nextStatus}`);
      load({ append: false });
    } catch (e) {
      const message =
        e?.message?.replace(
          "Could not update review status in any target path. ",
          ""
        ) || "Failed to update review status";
      toast.error(`Failed to update review status: ${message}`);
    }
  };

  const onDeleteReview = async (review) => {
    try {
      await deleteProductReview(
        review.id,
        {
          productId: review.productId,
          userId: review.userId || review.uid || review.id,
          __path: review.__path,
        },
        review.__col || "productReviews"
      );
      toast.success("Review deleted");
      load({ append: false });
    } catch {
      toast.error("Failed to delete review");
    }
  };

  const onCreateReview = async (e) => {
    e.preventDefault();
    if (!form.userName.trim()) {
      toast.error("Reviewer name is required");
      return;
    }
    if (!form.text.trim()) {
      toast.error("Review text is required");
      return;
    }

    setSaving(true);
    try {
      let mediaUrl = "";
      if (mediaFile) {
        const path = `reviews/${Date.now()}_${mediaFile.name}`;
        const storageRef = ref(storage, path);
        mediaUrl = await new Promise((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, mediaFile);
          task.on("state_changed", null, reject, () => {
            getDownloadURL(task.snapshot.ref).then(resolve).catch(reject);
          });
        });
      }

      await addProductReview({
        productId: form.productId.trim(),
        productName: form.productName.trim(),
        userId: form.userId.trim(),
        userName: form.userName.trim(),
        userEmail: form.userEmail.trim(),
        userPhone: form.userPhone.trim(),
        text: form.text.trim(),
        rating: Number(form.rating || 0),
        mediaUrls: mediaUrl ? [mediaUrl] : [],
        approved: false,
        status: "pending",
        submittedByAdmin: true,
      });

      toast.success("Review created");
      setForm(emptyForm);
      setMediaFile(null);
      setMediaPreview("");
      setFormOpen(false);
      load({ append: false });
    } catch {
      toast.error("Failed to create review");
    } finally {
      setSaving(false);
    }
  };

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  return (
    <>
      <div className="page-header">
        <div>
          <h2>All Reviews</h2>
          <div className="breadcrumb">Dashboard / <span>All Reviews</span></div>
        </div>
      </div>

      {!loading && filtered.length > 0 ? (
        <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
          {hasMore ? (
            <button
              type="button"
              className="btn btn-outline"
              disabled={loadingMore}
              onClick={() => load({ append: true })}
            >
              {loadingMore ? "Loading..." : "Load more reviews"}
            </button>
          ) : (
            <span className="text-muted" style={{ fontSize: 12 }}>
              End of reviews list
            </span>
          )}
        </div>
      ) : null}

      <div className="review-top-actions">
        <button className="btn btn-primary review-create-btn" onClick={() => setFormOpen(true)}>
          <MdAdd /> Create New Review
        </button>
      </div>

      <div className="card review-main-card">
        <div className="review-search-row">
          <div className="search-wrap review-search-wrap">
            <MdSearch />
            <input
              className="search-input review-search-input"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <MdImage />
            <p>No reviews found.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="review-ref-table">
              <thead>
                <tr>
                  <th style={{ width: 38 }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelected(new Set(filtered.map((r) => r.id)));
                        } else {
                          setSelected(new Set());
                        }
                      }}
                    />
                  </th>
                  <th>Product</th>
                  <th>Review</th>
                  <th>Rating</th>
                  <th>User</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((review) => {
                  const status = normalizeStatus(review);
                  const isApproved = status === "approved";
                  const image = getReviewImage(review);
                  const rating = getRating(review);
                  const userName = getReviewerName(review);
                  const initials = (userName || "U").trim().charAt(0).toUpperCase();

                  return (
                    <tr key={`${review.__col || "productReviews"}-${review.id}`}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(review.id)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(review.id);
                            else next.delete(review.id);
                            setSelected(next);
                          }}
                        />
                      </td>
                      <td>
                        <div className="review-product-cell">
                          {image ? (
                            <button
                              type="button"
                              className="review-image-button"
                              title="View image"
                              onClick={() => setPreviewImage(image)}
                            >
                              <img
                                src={image}
                                alt="product"
                                className="review-row-image"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  const fallback =
                                      e.currentTarget.parentElement?.nextElementSibling;
                                  if (fallback) fallback.style.display = "flex";
                                }}
                              />
                            </button>
                          ) : null}
                          <div
                            className="review-row-image-fallback"
                            style={{ display: image ? "none" : "flex" }}
                          >
                            <MdImage />
                          </div>
                          <div className="review-product-name">
                            {review.productName || review.product?.name || "-"}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="review-linkish">{getReviewText(review) || "-"}</div>
                      </td>
                      <td>
                        <div className="review-rating-cell">
                          <RatingStars rating={rating} />
                          <span className="text-muted">{rating.toFixed(1)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="review-user-cell">
                          <div className="review-user-avatar">{initials}</div>
                          <div className="review-user-name">{userName}</div>
                        </div>
                      </td>
                      <td className="text-muted">{getReviewerEmail(review)}</td>
                      <td className="text-muted">{getReviewerPhone(review)}</td>
                      <td>
                        <button
                          className={`review-approve-pill ${isApproved ? "approved" : ""}`.trim()}
                          onClick={() => toggleApprove(review)}
                          title={isApproved ? "Move to pending" : "Approve"}
                        >
                          <MdCheckCircle /> {isApproved ? "Approved" : "Approve"}
                        </button>
                      </td>
                      <td className="text-muted">{formatDate(getReviewDate(review))}</td>
                      <td>
                        <button className="review-delete-btn" onClick={() => onDeleteReview(review)}>
                          <MdDeleteOutline />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formOpen && (
        <div className="modal-overlay" onClick={() => setFormOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create New Review</h3>
              <button className="modal-close" onClick={() => setFormOpen(false)}>
                <MdClose />
              </button>
            </div>
            <form onSubmit={onCreateReview}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Reviewer Name *</label>
                  <input
                    value={form.userName}
                    onChange={(e) => setForm((f) => ({ ...f, userName: e.target.value }))}
                    placeholder="Customer name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Reviewer Email</label>
                  <input
                    value={form.userEmail}
                    onChange={(e) => setForm((f) => ({ ...f, userEmail: e.target.value }))}
                    placeholder="customer@email.com"
                  />
                </div>
                <div className="form-group">
                  <label>Reviewer Phone</label>
                  <input
                    value={form.userPhone}
                    onChange={(e) => setForm((f) => ({ ...f, userPhone: e.target.value }))}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="form-group">
                  <label>Product Name</label>
                  <input
                    value={form.productName}
                    onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
                    placeholder="Product name"
                  />
                </div>
                <div className="form-group">
                  <label>Product ID (required for sync)</label>
                  <input
                    value={form.productId}
                    onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                    placeholder="Firestore product doc id"
                  />
                </div>
                <div className="form-group">
                  <label>User ID (required for sync)</label>
                  <input
                    value={form.userId}
                    onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                    placeholder="Reviewer uid"
                  />
                </div>
                <div className="form-group">
                  <label>Rating (0-5)</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={form.rating}
                    onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
                  />
                </div>
                <div className="form-group full">
                  <label>Review Text *</label>
                  <textarea
                    value={form.text}
                    onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                    placeholder="What customer said about the product"
                    required
                  />
                </div>
                <div className="form-group full">
                  <label>Review Media</label>
                  <div className="img-upload" onClick={() => mediaInputRef.current?.click()}>
                    <input
                      ref={mediaInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setMediaFile(file);
                        setMediaPreview(URL.createObjectURL(file));
                      }}
                    />
                    {mediaPreview ? (
                      <img src={mediaPreview} className="img-preview" alt="review preview" />
                    ) : (
                      <MdCloudUpload style={{ fontSize: 36, color: "var(--text-secondary)" }} />
                    )}
                    <div className="img-upload-label">
                      <span>Upload review image</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="form-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setForm(emptyForm);
                    setMediaFile(null);
                    setMediaPreview("");
                  }}
                >
                  Reset
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <MdAdd /> {saving ? "Creating..." : "Create Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage("")}>
          <div className="modal review-image-viewer" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Review Image</h3>
              <button className="modal-close" onClick={() => setPreviewImage("")}>
                <MdClose />
              </button>
            </div>
            <div className="review-image-viewer-body">
              <img src={previewImage} alt="Review" className="review-image-viewer-img" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
