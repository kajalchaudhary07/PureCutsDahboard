import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { MdArrowBack, MdCloudUpload, MdDelete } from "react-icons/md";
import { deleteObject, ref } from "firebase/storage";
import { storage } from "../../firebaseConfig";
import {
  addProductSuggestion,
  deleteProductSuggestionImage,
  getProductSuggestionById,
  updateProductSuggestion,
  uploadProductSuggestionImage,
} from "../../firestoreService";

const STATUS_OPTIONS = ["submitted", "pending", "approved", "rejected"];

const toDisplayDate = (value) => {
  if (!value) return "";
  if (typeof value?.toDate === "function") return value.toDate().toLocaleString();
  if (value instanceof Date) return value.toLocaleString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString();
};

export default function ProductSuggestionForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleteExistingImage, setDeleteExistingImage] = useState(false);
  const [existing, setExisting] = useState(null);
  const fileInputRef = useRef(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [form, setForm] = useState({
    uid: "",
    orderRef: "",
    orderId: "",
    text: "",
    status: "submitted",
    adminNotes: "",
    imageUrl: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
      setPreviewImage(null);
    };
  }, [imagePreview]);

  useEffect(() => {
    const load = async () => {
      if (!isEdit) {
        setLoading(false);
        return;
      }

      try {
        const row = await getProductSuggestionById(id);
        if (!row) {
          toast.error("Product suggestion not found");
          navigate("/product-suggestions");
          return;
        }
        setExisting(row);
        setForm({
          uid: row.uid || "",
          orderRef: row.orderRef || "",
          orderId: row.orderId || "",
          text: row.text || "",
          status: row.status || "submitted",
          adminNotes: row.adminNotes || "",
          imageUrl: row.imageUrl || "",
        });
        setImagePreview(row.imageUrl || "");
        setPreviewImage(null);
      } catch (error) {
        toast.error(error?.message || "Failed to load suggestion");
        navigate("/product-suggestions");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const title = useMemo(
    () => (isEdit ? "Edit Product Suggestion" : "Create Product Suggestion"),
    [isEdit]
  );

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      event.target.value = "";
      return;
    }

    if (imagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setForm((prev) => ({ ...prev, imageUrl: "" }));
    setDeleteExistingImage(false);
    setPreviewImage(null);
  };

  const handleImageUrlChange = (value) => {
    if (imagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(value);
    setForm((prev) => ({ ...prev, imageUrl: value }));
    setDeleteExistingImage(false);
    setPreviewImage(null);
  };

  const removeSelectedImage = () => {
    if (imagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview("");
    setForm((prev) => ({ ...prev, imageUrl: "" }));
    setDeleteExistingImage(Boolean(existing?.imagePath));
    setPreviewImage(null);
  };

  const save = async (event) => {
    event.preventDefault();

    if (!form.uid.trim() || !form.orderRef.trim() || !form.orderId.trim() || !form.text.trim()) {
      toast.error("UID, order refs, and suggestion text are required");
      return;
    }

    setSaving(true);
    try {
      let nextImageUrl = form.imageUrl.trim();
      let nextImagePath = existing?.imagePath || "";

      if (imageFile) {
        const uploaded = await uploadProductSuggestionImage({
          uid: form.uid.trim(),
          file: imageFile,
        });
        nextImageUrl = uploaded.imageUrl;
        nextImagePath = uploaded.imagePath;
        if (existing?.imagePath && existing.imagePath !== nextImagePath) {
          try {
            await deleteProductSuggestionImage(existing.imagePath);
          } catch {
            // Best-effort cleanup only.
          }
        }
      } else if (deleteExistingImage && existing?.imagePath) {
        try {
          await deleteObject(ref(storage, existing.imagePath));
        } catch {
          // Ignore cleanup errors.
        }
        nextImageUrl = "";
        nextImagePath = "";
      } else if (
        nextImageUrl &&
        nextImageUrl !== (existing?.imageUrl || "").trim()
      ) {
        nextImagePath = "";
      }

      const payload = {
        uid: form.uid.trim(),
        orderRef: form.orderRef.trim(),
        orderId: form.orderId.trim(),
        text: form.text.trim(),
        status: form.status,
        adminNotes: form.adminNotes.trim(),
        imageUrl: nextImageUrl,
        imagePath: nextImagePath,
      };

      if (isEdit) {
        await updateProductSuggestion(id, payload);
        toast.success("Product suggestion updated");
      } else {
        await addProductSuggestion(payload);
        toast.success("Product suggestion created");
      }

      navigate("/product-suggestions");
    } catch (error) {
      toast.error(error?.message || "Failed to save product suggestion");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      {previewImage ? (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="modal product-suggestion-image-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Suggestion image</span>
              <button type="button" className="modal-close" onClick={() => setPreviewImage(null)}>
                ×
              </button>
            </div>
            <div className="product-suggestion-image-modal-body">
              <img src={previewImage} alt="Expanded product suggestion" className="product-suggestion-image-modal-img" />
            </div>
          </div>
        </div>
      ) : null}

      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <button type="button" className="breadcrumb-back" onClick={() => navigate("/product-suggestions")}>
              <MdArrowBack /> Back to Product Suggestions
            </button>
          </div>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="product-suggestion-form-layout">
        <section className="card">
          <div className="card-header">
            <span className="card-title">Suggestion Details</span>
          </div>
          <form className="form-grid" onSubmit={save}>
            <div className="form-group">
              <label>User UID *</label>
              <input
                value={form.uid}
                onChange={(e) => setForm((prev) => ({ ...prev, uid: e.target.value }))}
                placeholder="firebase-uid"
                required
              />
            </div>
            <div className="form-group">
              <label>Order Ref *</label>
              <input
                value={form.orderRef}
                onChange={(e) => setForm((prev) => ({ ...prev, orderRef: e.target.value }))}
                placeholder="PC-20260426-ABC123"
                required
              />
            </div>
            <div className="form-group">
              <label>Order ID *</label>
              <input
                value={form.orderId}
                onChange={(e) => setForm((prev) => ({ ...prev, orderId: e.target.value }))}
                placeholder="PC-20260426-ABC123"
                required
              />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status[0].toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group full">
              <label>Suggestion Text *</label>
              <textarea
                rows={5}
                maxLength={1000}
                value={form.text}
                onChange={(e) => setForm((prev) => ({ ...prev, text: e.target.value }))}
                placeholder="Describe the product you'd like to see on PureCuts…"
                required
              />
            </div>
            <div className="form-group full">
              <label>Admin Notes</label>
              <textarea
                rows={4}
                value={form.adminNotes}
                onChange={(e) => setForm((prev) => ({ ...prev, adminNotes: e.target.value }))}
                placeholder="Internal notes or customer follow-up details"
              />
            </div>
            <div className="form-group full">
              <label>Image</label>
              <div className="img-upload" onClick={() => fileInputRef.current?.click()}>
                <input ref={fileInputRef} id="product-suggestion-file" type="file" accept="image/*" onChange={handleFileChange} />
                {imagePreview ? (
                  <img src={imagePreview} className="img-preview product-suggestion-preview" alt="preview" />
                ) : (
                  <MdCloudUpload style={{ fontSize: 36, color: "var(--text-secondary)" }} />
                )}
                <div className="img-upload-label">
                  <span>{imageFile ? imageFile.name : "Choose an image from device"}</span>
                </div>
                <div className="img-upload-hint">Optional. Images are stored under the productSuggestions folder.</div>
              </div>
              <div className="suggestion-image-actions">
                <input
                  value={!imageFile ? form.imageUrl : ""}
                  onChange={(e) => handleImageUrlChange(e.target.value)}
                  placeholder="Or paste image URL"
                />
                {imagePreview || form.imageUrl ? (
                  <button type="button" className="btn btn-outline" onClick={() => setPreviewImage(imagePreview || form.imageUrl)}>
                    Expand
                  </button>
                ) : null}
                {(imagePreview || form.imageUrl) ? (
                  <button type="button" className="btn btn-outline" onClick={removeSelectedImage}>
                    <MdDelete /> Remove image
                  </button>
                ) : null}
              </div>
            </div>
            <div className="form-footer form-group full">
              <button className="btn btn-outline" type="button" onClick={() => navigate("/product-suggestions")}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                <MdCloudUpload /> {saving ? "Saving..." : isEdit ? "Update Suggestion" : "Create Suggestion"}
              </button>
            </div>
          </form>
        </section>

        <aside className="card product-suggestion-summary-card">
          <div className="card-header">
            <span className="card-title">Summary</span>
          </div>
          <div className="banner-summary-list">
            <div><span>User UID</span><strong>{form.uid || "—"}</strong></div>
            <div><span>Order Ref</span><strong>{form.orderRef || "—"}</strong></div>
            <div><span>Status</span><strong>{statusLabel(form.status)}</strong></div>
            <div><span>Image</span><strong>{imagePreview || form.imageUrl ? "Yes" : "No"}</strong></div>
            {isEdit ? (
              <div><span>Created</span><strong>{toDisplayDate(existing?.createdAt) || "—"}</strong></div>
            ) : null}
          </div>
        </aside>
      </div>
    </>
  );
}

function statusLabel(value) {
  const clean = String(value || "submitted").trim().toLowerCase();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "Submitted";
}
