import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  MdAdd,
  MdRateReview,
  MdSearch,
  MdCheckCircle,
  MdPending,
  MdDoNotDisturbOn,
  MdImage,
  MdCloudUpload,
} from "react-icons/md";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useAuth } from "../../auth/AuthProvider";
import { storage } from "../../firebaseConfig";
import {
  getProductReviews,
  addProductReview,
  approveProductReview,
  setProductReviewStatus,
} from "../../firestoreService";

const emptyForm = {
  productId: "",
  productName: "",
  userId: "",
  userName: "",
  userEmail: "",
  text: "",
  rating: "5",
};

const STATUS_TABS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

const normalizeStatus = (review) => {
  if (review.status) return String(review.status).toLowerCase();
  if (review.approved === true) return "approved";
  if (review.approved === false) return "pending";
  return "pending";
};

const getReviewDate = (review) => review.createdAt || review.submittedAt || review.date || review.reviewDate;

const formatDate = (value) => {
  if (!value) return "-";
  if (typeof value?.toDate === "function") return value.toDate().toLocaleString();
  if (value instanceof Date) return value.toLocaleString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const getReviewerName = (review) =>
  review.userName || review.user?.name || review.name || review.displayName || "Anonymous";

const getReviewText = (review) =>
  review.text || review.reviewText || review.comment || review.review || review.message || "";

const getRating = (review) => {
  const value = Number(review.rating ?? review.stars ?? 0);
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(5, value));
};

const getReviewImages = (review) => {
  const images = [];
  if (Array.isArray(review.images)) images.push(...review.images);
  if (Array.isArray(review.photos)) images.push(...review.photos);
  if (review.imageUrl) images.push(review.imageUrl);
  if (review.image) images.push(review.image);
  return images.filter(Boolean);
};

function Stars({ rating }) {
  const rounded = Math.round(rating);
  return (
    <span className="review-stars" aria-label={`Rating ${rounded} out of 5`}>
      {"*****".split("").map((star, idx) => (
        <span key={`${star}-${idx}`} className={idx < rounded ? "on" : "off"}>★</span>
      ))}
      <span className="text-muted" style={{ marginLeft: 6 }}>{rating.toFixed(1)}</span>
    </span>
  );
}

export default function ProductReviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState(emptyForm);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState("");
  const mediaInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getProductReviews();
      setReviews(data);
    } catch {
      toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter((review) => {
      const status = normalizeStatus(review);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;

      const name = getReviewerName(review).toLowerCase();
      const text = getReviewText(review).toLowerCase();
      const productName = String(review.productName || review.product?.name || "").toLowerCase();
      return name.includes(q) || text.includes(q) || productName.includes(q);
    });
  }, [reviews, search, statusFilter]);

  const updateStatus = async (review, status) => {
    try {
      if (status === "approved") {
        await approveProductReview(
          review.id,
          { approvedBy: user?.email || "admin" },
          review.__col || "productReviews"
        );
      } else {
        await setProductReviewStatus(
          review.id,
          status,
          { moderatedBy: user?.email || "admin" },
          review.__col || "productReviews"
        );
      }
      toast.success(`Review marked as ${status}`);
      load();
    } catch {
      toast.error("Failed to update review status");
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
        text: form.text.trim(),
        rating: Number(form.rating || 0),
        images: mediaUrl ? [mediaUrl] : [],
        approved: false,
        status: "pending",
        submittedByAdmin: true,
      });
      toast.success("Review created and pending approval");
      setForm(emptyForm);
      setMediaFile(null);
      setMediaPreview("");
      load();
    } catch {
      toast.error("Failed to create review");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Product Reviews</h2>
          <div className="breadcrumb">Home / <span>Product Reviews</span></div>
        </div>
      </div>

      <div className="review-layout">
        <div className="card review-create-card">
          <div className="card-header">
            <span className="card-title">Create Review</span>
          </div>
          <form onSubmit={onCreateReview}>
            <div className="form-grid single">
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
                <label>Product Name</label>
                <input
                  value={form.productName}
                  onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
                  placeholder="Product name"
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
                <MdAdd /> {saving ? "Creating..." : "Create Pending Review"}
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="card-header review-toolbar">
            <span className="card-title">Incoming Reviews ({filtered.length})</span>
            <div className="flex items-center gap-2">
              <div className="search-wrap">
                <MdSearch />
                <input
                  className="search-input"
                  placeholder="Search review, user or product"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="filter-row review-filter-row">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                className={`filter-tab ${statusFilter === tab.value ? "active" : ""}`}
                onClick={() => setStatusFilter(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="spinner-wrap"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <MdRateReview />
              <p>No reviews found for current filter.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Reviewer</th>
                    <th>Review</th>
                    <th>Rating</th>
                    <th>Photo</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((review, idx) => {
                    const status = normalizeStatus(review);
                    const images = getReviewImages(review);
                    const reviewDate = getReviewDate(review);

                    return (
                      <tr key={`${review.__col || "productReviews"}-${review.id}`}>
                        <td className="text-muted">{idx + 1}</td>
                        <td>
                          <div className="font-medium">{getReviewerName(review)}</div>
                          <div className="text-muted" style={{ fontSize: 12 }}>
                            {review.userEmail || review.email || "-"}
                          </div>
                        </td>
                        <td>
                          <div className="font-medium">{review.productName || review.product?.name || "Product review"}</div>
                          <div className="review-text">{getReviewText(review) || "-"}</div>
                        </td>
                        <td><Stars rating={getRating(review)} /></td>
                        <td>
                          {images.length > 0 ? (
                            <img src={images[0]} alt="review" className="table-img" />
                          ) : (
                            <div className="no-img"><MdImage /></div>
                          )}
                        </td>
                        <td className="text-muted">{formatDate(reviewDate)}</td>
                        <td>
                          <span className={`badge ${
                            status === "approved"
                              ? "badge-green"
                              : status === "rejected"
                                ? "badge-red"
                                : "badge-orange"
                          }`}>
                            {status}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => updateStatus(review, "approved")}
                              disabled={status === "approved"}
                              title="Approve review"
                            >
                              <MdCheckCircle /> Approve
                            </button>
                            <button
                              className="btn btn-warning btn-sm"
                              onClick={() => updateStatus(review, "pending")}
                              disabled={status === "pending"}
                              title="Move to pending"
                            >
                              <MdPending /> Pending
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => updateStatus(review, "rejected")}
                              disabled={status === "rejected"}
                              title="Reject review"
                            >
                              <MdDoNotDisturbOn /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
