import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  MdArrowBack,
  MdCloudUpload,
  MdImage,
  MdDeleteOutline,
  MdOutlineTipsAndUpdates,
  MdOutlineInventory2,
  MdOutlineCategory,
  MdOutlineSell,
  MdOutlinePhotoLibrary,
  MdAdd,
  MdSell,
  MdInventory,
} from "react-icons/md";
import {
  getProducts, addProduct, updateProduct,
} from "../../firestoreService";
import { getBrands, addBrand } from "../../firestoreService";
import { getCategories, addCategory } from "../../firestoreService";
import { getSubCategories } from "../../firestoreService";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebaseConfig";

const empty = {
  name: "", brand: "", category: "", price: "", originalPrice: "",
  subCategory: "", rating: "", reviews: "", image: "", tag: "", size: "",
  deliveryTime: "15 MINS", isPopular: false, isRecommended: false, stock: "",
  description: "",
  shortDescription: "",
  sku: "",
  productType: "single",
  visibility: "publish",
  tags: [],
  additionalImages: [],
  attributes: [],
  selectedCategories: [],
  manageStock: true,
  onSale: false,
  salePrice: "",
  variableOptions: "",
};

const ATTRIBUTE_OPTIONS = ["Sizes", "Color", "Material", "Weight", "Volume"];

export default function AddProduct() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(empty);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [additionalImageFiles, setAdditionalImageFiles] = useState([]);
  const [descriptionMediaFiles, setDescriptionMediaFiles] = useState([]);
  const [shortDescriptionMediaFiles, setShortDescriptionMediaFiles] = useState([]);
  const [selectedAttribute, setSelectedAttribute] = useState("");
  const [customAttributeName, setCustomAttributeName] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParent, setNewCategoryParent] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const fileRef = useRef();
  const additionalRef = useRef();
  const descriptionMediaRef = useRef();
  const shortMediaRef = useRef();

  useEffect(() => {
    getBrands().then(setBrands);
    getCategories().then(setCategories);
    getSubCategories().then(setSubCategories);
    if (isEdit) {
      getProducts().then((all) => {
        const found = all.find((p) => p.id === id);
        if (found) {
          const existingTags = Array.isArray(found.tags)
            ? found.tags
            : typeof found.tags === "string"
              ? found.tags.split(",").map((t) => t.trim()).filter(Boolean)
              : [];
          const existingAttributes = Array.isArray(found.attributes) ? found.attributes : [];
          const existingAdditional = Array.isArray(found.additionalImages) ? found.additionalImages : [];

          setForm({
            ...empty,
            ...found,
            subCategory: found.subCategory || found.subcategory || found.sub_category || "",
            image: found.image || found.imageUrl || "",
            visibility: found.visibility || "publish",
            productType: found.productType || "single",
            tags: existingTags,
            attributes: existingAttributes,
            additionalImages: existingAdditional,
            shortDescription: found.shortDescription || "",
            selectedCategories: Array.isArray(found.selectedCategories)
              ? found.selectedCategories
              : found.category
                ? [found.category]
                : [],
            manageStock: found.manageStock !== false,
            onSale: Boolean(found.onSale),
            salePrice: found.salePrice || "",
            variableOptions: found.variableOptions || "",
          });
          if (found.image || found.imageUrl) setImagePreview(found.image || found.imageUrl);
        }
      });
    }
  }, [id]);

  useEffect(() => {
    if (!form.category) return;
    const selected = subCategories.find((s) => s.name === form.subCategory);
    if (!selected) {
      setForm((f) => ({ ...f, subCategory: "" }));
    }
  }, [form.category, form.subCategory, subCategories]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleCategory = (name) => {
    if (form.selectedCategories.includes(name)) {
      const updated = form.selectedCategories.filter((c) => c !== name);
      set("selectedCategories", updated);
      if (form.category === name) {
        set("category", updated[0] || "");
        set("subCategory", "");
      }
      return;
    }

    const updated = [...form.selectedCategories, name];
    set("selectedCategories", updated);
    if (!form.category) {
      set("category", name);
    }
  };

  const createCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error("Category name is required");
      return;
    }
    if (categories.some((c) => c.name?.toLowerCase() === name.toLowerCase())) {
      toast.warning("Category already exists");
      return;
    }

    try {
      await addCategory({
        name,
        parentCategory: newCategoryParent || "",
      });
      const all = await getCategories();
      setCategories(all);
      toggleCategory(name);
      setNewCategoryName("");
      setNewCategoryParent("");
      toast.success("Category added");
    } catch {
      toast.error("Failed to add category");
    }
  };

  const createBrand = async () => {
    const name = newBrandName.trim();
    if (!name) {
      toast.error("Brand name is required");
      return;
    }
    if (brands.some((b) => b.name?.toLowerCase() === name.toLowerCase())) {
      toast.warning("Brand already exists");
      return;
    }

    try {
      await addBrand({ name });
      const all = await getBrands();
      setBrands(all);
      set("brand", name);
      setNewBrandName("");
      toast.success("Brand added");
    } catch {
      toast.error("Failed to add brand");
    }
  };

  const addShortDescriptionMedia = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      e.target.value = "";
      return;
    }

    setShortDescriptionMediaFiles((prev) => [...prev, file]);
    e.target.value = "";
  };

  const addDescriptionMedia = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      e.target.value = "";
      return;
    }

    setDescriptionMediaFiles((prev) => [...prev, file]);
    e.target.value = "";
  };

  const saveTag = () => {
    const value = tagInput.trim().toLowerCase();
    if (!value) return;
    if (form.tags.includes(value)) {
      setTagInput("");
      return;
    }
    set("tags", [...form.tags, value]);
    setTagInput("");
  };

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

  const handleAdditionalImagesChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const valid = files.filter((f) => f.type.startsWith("image/"));
    if (valid.length !== files.length) {
      toast.warning("Some files were skipped because they are not images");
    }

    const next = valid.map((file) => ({
      id: `${Date.now()}_${file.name}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setAdditionalImageFiles((prev) => [...prev, ...next].slice(0, 8));
    e.target.value = "";
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

  const uploadAdditionalImages = async () => {
    if (!additionalImageFiles.length) return [];

    const uploads = additionalImageFiles.map(({ file }) => {
      const storageRef = ref(storage, `products/additional/${Date.now()}_${file.name}`);
      return new Promise((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, file);
        task.on(
          "state_changed",
          () => {},
          reject,
          () => getDownloadURL(task.snapshot.ref).then(resolve)
        );
      });
    });

    return Promise.all(uploads);
  };

  const uploadShortDescriptionMedia = async () => {
    if (!shortDescriptionMediaFiles.length) return [];

    const uploads = shortDescriptionMediaFiles.map((file) => {
      const storageRef = ref(storage, `products/short-description/${Date.now()}_${file.name}`);
      return new Promise((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, file);
        task.on(
          "state_changed",
          () => {},
          reject,
          () => getDownloadURL(task.snapshot.ref).then(resolve)
        );
      });
    });

    return Promise.all(uploads);
  };

  const uploadDescriptionMedia = async () => {
    if (!descriptionMediaFiles.length) return [];

    const uploads = descriptionMediaFiles.map((file) => {
      const storageRef = ref(storage, `products/description/${Date.now()}_${file.name}`);
      return new Promise((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, file);
        task.on(
          "state_changed",
          () => {},
          reject,
          () => getDownloadURL(task.snapshot.ref).then(resolve)
        );
      });
    });

    return Promise.all(uploads);
  };

  const addAttribute = () => {
    const name = (customAttributeName.trim() || selectedAttribute).trim();
    if (!name) return;
    if (form.attributes.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      setCustomAttributeName("");
      setSelectedAttribute("");
      return;
    }

    set("attributes", [...form.attributes, { name, values: [], useForVariations: true }]);
    setCustomAttributeName("");
    setSelectedAttribute("");
  };

  const updateAttributeValues = (name, raw) => {
    const values = raw.split(",").map((v) => v.trim()).filter(Boolean);
    set(
      "attributes",
      form.attributes.map((attr) => (attr.name === name ? { ...attr, values } : attr))
    );
  };

  const toggleAttributeVariation = (name, checked) => {
    set(
      "attributes",
      form.attributes.map((attr) => (
        attr.name === name ? { ...attr, useForVariations: checked } : attr
      ))
    );
  };

  const removeAttribute = (name) => {
    set("attributes", form.attributes.filter((attr) => attr.name !== name));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Product name is required"); return; }
    if (!form.price)        { toast.error("Price is required"); return; }

    setSaving(true);
    try {
      const imageUrl = await uploadImage();
      const additionalUrls = await uploadAdditionalImages();
      const descriptionMediaUrls = await uploadDescriptionMedia();
      const shortMediaUrls = await uploadShortDescriptionMedia();
      const mergedAdditionalImages = [...(form.additionalImages || []), ...additionalUrls];
      const mergedDescription = [
        form.description || "",
        ...descriptionMediaUrls.map((url) => `![media](${url})`),
      ]
        .filter(Boolean)
        .join("\n");
      const mergedShortDescription = [
        form.shortDescription || "",
        ...shortMediaUrls.map((url) => `![media](${url})`),
      ]
        .filter(Boolean)
        .join("\n");
      const data = {
        ...form,
        shortDescription: mergedShortDescription,
        category: form.selectedCategories[0] || form.category || "",
        selectedCategories: form.selectedCategories || [],
        subCategory: form.subCategory || "",
        subcategory: form.subCategory || "",
        description: mergedDescription,
        price:         Number(form.price)         || 0,
        originalPrice: Number(form.originalPrice) || 0,
        salePrice:     Number(form.salePrice)      || 0,
        rating:        Number(form.rating)         || 0,
        reviews:       Number(form.reviews)        || 0,
        stock:         form.manageStock ? Number(form.stock) || 0 : 0,
        image: imageUrl,
        imageUrl: imageUrl,
        tags: form.tags || [],
        additionalImages: mergedAdditionalImages,
        attributes: form.attributes || [],
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
    <div className="product-editor-page">
      <div className="product-editor-header">
        <button type="button" className="product-back-btn" onClick={() => navigate("/products")}>
          <MdArrowBack />
        </button>
        <h1>{isEdit ? "Edit Product" : "Create Product"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="product-editor-layout">
        <section className="product-editor-main">
          <div className="pe-card">
            <div className="pe-title-row">
              <span className="pe-icon"><MdOutlineInventory2 /></span>
              <h3>Basic Information</h3>
            </div>
            <input
              className="pe-input"
              placeholder="Product Title"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
            <div className="pe-editor-head">
              <div className="pe-editor-label">Text Editor</div>
              <div className="pe-short-actions">
                <input
                  ref={descriptionMediaRef}
                  type="file"
                  accept="image/*"
                  onChange={addDescriptionMedia}
                  style={{ display: "none" }}
                />
                <button type="button" className="btn btn-outline btn-sm" onClick={() => descriptionMediaRef.current?.click()}>
                  <MdImage /> Add Media
                </button>
              </div>
            </div>
            <div className="pe-editor-toolbar">
              <span>B</span>
              <span>I</span>
              <span>U</span>
              <span>H1</span>
              <span>List</span>
              <span>Link</span>
              <span>Align</span>
            </div>
            <textarea
              className="pe-editor"
              placeholder="Start typing..."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
            {descriptionMediaFiles.length > 0 && (
              <div className="pe-short-media-list" style={{ marginTop: 10 }}>
                {descriptionMediaFiles.map((file, index) => (
                  <span key={`${file.name}_${index}`} className="pe-short-media-chip">
                    {file.name}
                    <button
                      type="button"
                      onClick={() => setDescriptionMediaFiles((prev) => prev.filter((_, i) => i !== index))}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="pe-short-desc-wrap">
              <div className="pe-short-desc-head">
                <h4>Product short description</h4>
                <div className="pe-short-actions">
                  <input
                    ref={shortMediaRef}
                    type="file"
                    accept="image/*"
                    onChange={addShortDescriptionMedia}
                    style={{ display: "none" }}
                  />
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => shortMediaRef.current?.click()}>
                    <MdImage /> Add Media
                  </button>
                </div>
              </div>
              <textarea
                className="pe-short-desc"
                placeholder="Write a short product summary..."
                value={form.shortDescription}
                onChange={(e) => set("shortDescription", e.target.value)}
              />
              {shortDescriptionMediaFiles.length > 0 && (
                <div className="pe-short-media-list">
                  {shortDescriptionMediaFiles.map((file, index) => (
                    <span key={`${file.name}_${index}`} className="pe-short-media-chip">
                      {file.name}
                      <button
                        type="button"
                        onClick={() => setShortDescriptionMediaFiles((prev) => prev.filter((_, i) => i !== index))}
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pe-card">
            <div className="pe-title-row">
              <span className="pe-icon"><MdOutlineTipsAndUpdates /></span>
              <h3>Product Configuration & Management</h3>
            </div>

            <div className="pe-inline-group">
              <strong>Product Type</strong>
              <label className="pe-radio"><input type="radio" name="ptype" checked={form.productType === "single"} onChange={() => set("productType", "single")} /> Single</label>
              <label className="pe-radio"><input type="radio" name="ptype" checked={form.productType === "variable"} onChange={() => set("productType", "variable")} /> Variable</label>
            </div>

            <div className="pe-grid-4">
              <input className="pe-input" placeholder="SKU" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
              <input className="pe-input" placeholder="Price" type="number" min="0" value={form.price} onChange={(e) => set("price", e.target.value)} required />
              <input className="pe-input" placeholder="Regular Price" type="number" min="0" value={form.originalPrice} onChange={(e) => set("originalPrice", e.target.value)} />
              <input className="pe-input" placeholder="Sale Price" type="number" min="0" value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} disabled={!form.onSale} />
            </div>

            <div className="pe-inline-group pe-feature-row">
              <label className="pe-check">
                <input type="checkbox" checked={form.onSale} onChange={(e) => set("onSale", e.target.checked)} />
                <MdSell /> On Sale
              </label>
              <label className="pe-check">
                <input type="checkbox" checked={form.manageStock} onChange={(e) => set("manageStock", e.target.checked)} />
                <MdInventory /> Manage Stock
              </label>
              {form.manageStock && (
                <input className="pe-input pe-stock-inline" placeholder="Stock" type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} />
              )}
            </div>

            {form.productType === "variable" && (
              <div className="pe-variable-box">
                <label>Variation options</label>
                <input
                  className="pe-input"
                  placeholder="e.g. size: S, M, L | color: black, blue"
                  value={form.variableOptions}
                  onChange={(e) => set("variableOptions", e.target.value)}
                />
              </div>
            )}

            <hr className="pe-sep" />

            <div className="pe-title-row" style={{ marginBottom: 12 }}>
              <span className="pe-icon"><MdOutlineCategory /></span>
              <h3>Product Attributes</h3>
            </div>

            <div className="pe-attribute-add">
              <select value={selectedAttribute} onChange={(e) => setSelectedAttribute(e.target.value)}>
                <option value="">Select Attribute</option>
                {ATTRIBUTE_OPTIONS.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <input
                className="pe-input"
                placeholder="Or custom attribute name"
                value={customAttributeName}
                onChange={(e) => setCustomAttributeName(e.target.value)}
              />
              <button type="button" className="btn btn-outline" onClick={addAttribute}><MdAdd /> Add</button>
            </div>

            <div className="pe-attribute-list">
              {form.attributes.length === 0 && <p className="text-muted">No attributes added yet.</p>}
              {form.attributes.map((attr) => (
                <div className="pe-attribute-item" key={attr.name}>
                  <div className="pe-attribute-meta">
                    <div className="font-medium">{attr.name}</div>
                    <input
                      className="pe-input pe-attr-values"
                      placeholder="Values (comma separated)"
                      value={Array.isArray(attr.values) ? attr.values.join(", ") : ""}
                      onChange={(e) => updateAttributeValues(attr.name, e.target.value)}
                    />
                    <label className="pe-check" style={{ marginTop: 6 }}>
                      <input
                        type="checkbox"
                        checked={attr.useForVariations !== false}
                        onChange={(e) => toggleAttributeVariation(attr.name, e.target.checked)}
                      />
                      Use for variations
                    </label>
                  </div>
                  <button type="button" className="pe-delete-btn" onClick={() => removeAttribute(attr.name)}>
                    <MdDeleteOutline />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="product-editor-side">
          <div className="pe-card">
            <div className="pe-title-row">
              <span className="pe-icon"><MdOutlineTipsAndUpdates /></span>
              <h3>Product Visibility</h3>
            </div>
            <label className="pe-radio"><input type="radio" name="visibility" checked={form.visibility === "publish"} onChange={() => set("visibility", "publish")} /> Publish</label>
            <label className="pe-radio"><input type="radio" name="visibility" checked={form.visibility === "draft"} onChange={() => set("visibility", "draft")} /> Draft</label>
          </div>

          <div className="pe-card">
            <div className="pe-title-row">
              <span className="pe-icon"><MdImage /></span>
              <h3>Product Thumbnail</h3>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
            <div className="pe-thumb-upload" onClick={() => fileRef.current.click()}>
              {imagePreview ? (
                <img src={imagePreview} className="pe-thumb-preview" alt="thumbnail" />
              ) : (
                <div className="pe-thumb-placeholder">
                  <MdCloudUpload />
                  <p>Upload product image</p>
                </div>
              )}
            </div>
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="text-muted" style={{ marginTop: 8 }}>Uploading... {uploadProgress}%</div>
            )}
            <input
              className="pe-input"
              placeholder="Or paste thumbnail URL"
              value={!imageFile ? form.image : ""}
              onChange={(e) => {
                setImageFile(null);
                setImagePreview(e.target.value || null);
                set("image", e.target.value);
              }}
            />
          </div>

          <div className="pe-card">
            <div className="pe-title-row">
              <span className="pe-icon"><MdOutlinePhotoLibrary /></span>
              <h3>Additional Images</h3>
            </div>
            <input
              ref={additionalRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleAdditionalImagesChange}
              style={{ display: "none" }}
            />
            <div className="pe-gallery-row">
              {form.additionalImages.map((url) => (
                <div className="pe-mini-thumb" key={url}>
                  <img src={url} alt="additional" />
                  <button
                    type="button"
                    onClick={() => set("additionalImages", form.additionalImages.filter((u) => u !== url))}
                  >
                    <MdDeleteOutline />
                  </button>
                </div>
              ))}
              {additionalImageFiles.map((item) => (
                <div className="pe-mini-thumb" key={item.id}>
                  <img src={item.preview} alt="additional" />
                  <button
                    type="button"
                    onClick={() => setAdditionalImageFiles((prev) => prev.filter((img) => img.id !== item.id))}
                  >
                    <MdDeleteOutline />
                  </button>
                </div>
              ))}
              <button type="button" className="pe-add-image-btn" onClick={() => additionalRef.current.click()}>
                <MdAdd />
              </button>
            </div>
          </div>

          <div className="pe-card">
            <div className="pe-title-row">
              <span className="pe-icon"><MdOutlineInventory2 /></span>
              <h3>Product Brand</h3>
            </div>
            <div className="pe-scroll-select">
              {brands.length === 0 && <p className="text-muted">No brands available.</p>}
              {brands.map((b) => (
                <label key={b.id} className="pe-list-option">
                  <input
                    type="radio"
                    name="brand"
                    checked={form.brand === b.name}
                    onChange={() => set("brand", b.name)}
                  />
                  <span>{b.name}</span>
                </label>
              ))}
            </div>
            <div className="pe-inline-add">
              <input
                className="pe-input"
                placeholder="Add new brand"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
              />
              <button type="button" className="btn btn-outline" onClick={createBrand}>Add</button>
            </div>
          </div>

          <div className="pe-card">
            <div className="pe-title-row">
              <span className="pe-icon"><MdOutlineCategory /></span>
              <h3>Product Categories</h3>
            </div>
            <div className="pe-scroll-select">
              {categories.length > 0
                ? categories.map((c) => (
                  <label key={c.id} className="pe-list-option">
                    <input
                      type="checkbox"
                      checked={form.selectedCategories.includes(c.name)}
                      onChange={() => toggleCategory(c.name)}
                    />
                    <span>{c.name}</span>
                  </label>
                ))
                : ["Hair Care", "Color", "Tools", "Skin Care", "Nail", "Beard", "Wax"].map((c) => (
                  <label key={c} className="pe-list-option">
                    <input
                      type="checkbox"
                      checked={form.selectedCategories.includes(c)}
                      onChange={() => toggleCategory(c)}
                    />
                    <span>{c}</span>
                  </label>
                ))}
            </div>

            <select
              value={form.subCategory}
              onChange={(e) => set("subCategory", e.target.value)}
              disabled={!form.category}
            >
              <option value="">Select sub category</option>
              {subCategories
                .filter((s) => !form.category || s.parentCategory === form.category)
                .map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
            </select>

            {form.selectedCategories.length === 0 && <p className="text-muted">There are no Categories selected</p>}

            <div className="pe-inline-add pe-category-add">
              <input
                className="pe-input"
                placeholder="Add new category"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <select value={newCategoryParent} onChange={(e) => setNewCategoryParent(e.target.value)}>
                <option value="">Parent category (optional)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <button type="button" className="btn btn-outline" onClick={createCategory}>Add</button>
            </div>
          </div>

          <div className="pe-card">
            <div className="pe-title-row">
              <span className="pe-icon"><MdOutlineSell /></span>
              <h3>Product Tags</h3>
            </div>
            <p className="text-muted" style={{ marginBottom: 10 }}>
              Note: use tags to improve search. Add lowercase tags.
            </p>
            <div className="pe-tag-input-row">
              <input
                className="pe-input"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveTag();
                  }
                }}
                placeholder="Tags"
              />
              <button type="button" className="btn btn-outline" onClick={saveTag}>Add</button>
            </div>
            <div className="pe-tag-list">
              {form.tags.map((tag) => (
                <span className="pe-tag-chip" key={tag}>
                  {tag}
                  <button type="button" onClick={() => set("tags", form.tags.filter((t) => t !== tag))}>x</button>
                </span>
              ))}
            </div>
          </div>
        </aside>

        <div className="pe-actions-bar">
          <button type="button" className="btn btn-outline" onClick={() => navigate("/products")}>Discard</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
