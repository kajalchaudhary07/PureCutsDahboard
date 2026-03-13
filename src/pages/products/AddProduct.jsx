import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { MdArrowBack, MdCloudUpload, MdImage } from "react-icons/md";
import {
  getProducts, addProduct, updateProduct,
} from "../../firestoreService";
import { getBrands } from "../../firestoreService";
import { getCategories } from "../../firestoreService";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebaseConfig";

const TAGS    = ["", "Bestseller", "Top Rated", "Premium", "Deal", "New"];
const DELIVER = ["15 MINS", "30 MINS", "1 HOUR", "Same Day", "Next Day"];

const empty = {
  name: "", brand: "", category: "", price: "", originalPrice: "",
  rating: "", reviews: "", image: "", tag: "", size: "",
  deliveryTime: "15 MINS", isPopular: false, isRecommended: false, stock: "",
};

export default function AddProduct() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(empty);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileRef = useRef();

  useEffect(() => {
    getBrands().then(setBrands);
    getCategories().then(setCategories);
    if (isEdit) {
      getProducts().then((all) => {
        const found = all.find((p) => p.id === id);
        if (found) {
          setForm({ ...empty, ...found });
          if (found.image) setImagePreview(found.image);
        }
      });
    }
  }, [id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async () => {
    if (!imageFile) return form.image || "";
    const storageRef = ref(storage, `products/${Date.now()}_${imageFile.name}`);
    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, imageFile);
      task.on(
        "state_changed",
        (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        reject,
        () => getDownloadURL(task.snapshot.ref).then(resolve)
      );
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Product name is required"); return; }
    if (!form.price)        { toast.error("Price is required"); return; }

    setSaving(true);
    try {
      const imageUrl = await uploadImage();
      const data = {
        ...form,
        price:         Number(form.price)         || 0,
        originalPrice: Number(form.originalPrice) || 0,
        rating:        Number(form.rating)         || 0,
        reviews:       Number(form.reviews)        || 0,
        stock:         Number(form.stock)          || 0,
        image: imageUrl,
      };
      if (isEdit) {
        await updateProduct(id, data);
        toast.success("Product updated!");
      } else {
        await addProduct(data);
        toast.success("Product added!");
      }
      navigate("/products");
    } catch (err) {
      toast.error("Failed to save product");
      console.error(err);
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>{isEdit ? "Edit Product" : "Add Product"}</h2>
          <div className="breadcrumb">
            Home / Products / <span>{isEdit ? "Edit" : "Add"}</span>
          </div>
        </div>
        <button className="btn btn-outline" onClick={() => navigate("/products")}>
          <MdArrowBack /> Back
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Product Information</span>
          </div>

          <div className="form-grid">
            {/* Image upload */}
            <div className="form-group full">
              <label>Product Image</label>
              <div
                className="img-upload"
                onClick={() => fileRef.current.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                />
                {imagePreview ? (
                  <>
                    <img src={imagePreview} className="img-preview" alt="preview" />
                    <div className="img-upload-label">
                      <span>Change image</span>
                    </div>
                  </>
                ) : (
                  <>
                    <MdCloudUpload style={{ fontSize: 36, color: "var(--text-secondary)", marginBottom: 8 }} />
                    <div className="img-upload-label">
                      <span>Click to upload</span> or drag & drop
                    </div>
                    <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>PNG, JPG, WEBP up to 5MB</div>
                  </>
                )}
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--primary)" }}>
                    Uploading… {uploadProgress}%
                  </div>
                )}
              </div>

              {/* Or paste URL */}
              <div style={{ marginTop: 8 }}>
                <input
                  placeholder="Or paste image URL…"
                  value={!imageFile ? form.image : ""}
                  onChange={(e) => {
                    setImageFile(null);
                    setImagePreview(e.target.value || null);
                    set("image", e.target.value);
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Product Name *</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Anti-Hair Fall Shampoo" required />
            </div>

            <div className="form-group">
              <label>Brand</label>
              <select value={form.brand} onChange={(e) => set("brand", e.target.value)}>
                <option value="">Select brand…</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)}>
                <option value="">Select category…</option>
                {categories.length > 0
                  ? categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)
                  : ["Hair Care","Color","Tools","Skin Care","Nail","Beard","Wax"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))
                }
              </select>
            </div>

            <div className="form-group">
              <label>Selling Price (₹) *</label>
              <input type="number" min="0" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0" required />
            </div>

            <div className="form-group">
              <label>MRP / Original Price (₹)</label>
              <input type="number" min="0" value={form.originalPrice} onChange={(e) => set("originalPrice", e.target.value)} placeholder="0" />
            </div>

            <div className="form-group">
              <label>Size / Volume</label>
              <input value={form.size} onChange={(e) => set("size", e.target.value)} placeholder="e.g. 250 ml" />
            </div>

            <div className="form-group">
              <label>Tag</label>
              <select value={form.tag} onChange={(e) => set("tag", e.target.value)}>
                {TAGS.map((t) => <option key={t} value={t}>{t || "No Tag"}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Delivery Time</label>
              <select value={form.deliveryTime} onChange={(e) => set("deliveryTime", e.target.value)}>
                {DELIVER.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Rating</label>
              <input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(e) => set("rating", e.target.value)} placeholder="4.5" />
            </div>

            <div className="form-group">
              <label>Reviews Count</label>
              <input type="number" min="0" value={form.reviews} onChange={(e) => set("reviews", e.target.value)} placeholder="0" />
            </div>

            <div className="form-group">
              <label>Stock Quantity</label>
              <input type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} placeholder="0" />
            </div>

            <div className="form-group" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ marginBottom: 0 }}>Popular</label>
                <label className="switch">
                  <input type="checkbox" checked={form.isPopular} onChange={(e) => set("isPopular", e.target.checked)} />
                  <span className="slider" />
                </label>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ marginBottom: 0 }}>Recommended</label>
                <label className="switch">
                  <input type="checkbox" checked={form.isRecommended} onChange={(e) => set("isRecommended", e.target.checked)} />
                  <span className="slider" />
                </label>
              </div>
            </div>
          </div>

          <div className="form-footer">
            <button type="button" className="btn btn-outline" onClick={() => navigate("/products")}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Update Product" : "Add Product"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
