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
  getProducts, updateProduct, createProduct,
} from "../../firestoreService";
import { getBrands, addBrand } from "../../firestoreService";
import { getCategories } from "../../firestoreService";
import {
  getSubCategories,
  getSubSubCategories,
  addSubCategory,
  createVariant,
  getProductVariants,
  deleteProductVariant,
  getAttributes,
} from "../../firestoreService";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebaseConfig";

const empty = {
  name: "", brand: "", category: "", price: "", originalPrice: "",
  subCategory: "", subSubCategory: "", rating: "", reviews: "", image: "", tag: "", size: "",
  deliveryTime: "15 MINS", isPopular: false, isRecommended: false, stock: "",
  showInStartFirstOrder: false,
  showInRecommendedSalon: false,
  showInMostBought: false,
  showInPopularProducts: false,
  description: "",
  shortDescription: "",
  howToUse: "",
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

export default function AddProduct() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(empty);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [subSubCategories, setSubSubCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [additionalImageFiles, setAdditionalImageFiles] = useState([]);
  const [descriptionMediaFiles, setDescriptionMediaFiles] = useState([]);
  const [shortDescriptionMediaFiles, setShortDescriptionMediaFiles] = useState([]);
  const [globalAttributes, setGlobalAttributes] = useState([]);
  const [selectedGlobalAttr, setSelectedGlobalAttr] = useState(null);
  const [chosenAttrValues, setChosenAttrValues] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [variantRows, setVariantRows] = useState([]);
  const [existingVariantIds, setExistingVariantIds] = useState([]);
  const fileRef = useRef();
  const additionalRef = useRef();
  const descriptionMediaRef = useRef();
  const shortMediaRef = useRef();
  const descriptionEditorRef = useRef();

  const normalizeAttr = (value) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

  const normalizeSectionKey = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

  useEffect(() => {
    getAttributes().then(setGlobalAttributes).catch(() => setGlobalAttributes([]));
  }, []);

  useEffect(() => {
    getBrands().then(setBrands);
    getCategories().then(setCategories);
    getSubCategories().then(setSubCategories);
    getSubSubCategories().then(setSubSubCategories);
    if (isEdit) {
      getProducts().then((all) => {
        const found = all.find((p) => p.id === id);
        if (found) {
          const legacySections = [
            ...(Array.isArray(found.homeSections) ? found.homeSections : []),
            found.homeSection,
            found.home_section,
            found.section,
            found.tag,
          ]
            .map(normalizeSectionKey)
            .filter(Boolean);
          const hasLegacy = (aliases) =>
            aliases.some((a) => legacySections.includes(normalizeSectionKey(a)));

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
            subSubCategory:
              found.subSubCategory ||
              found.subsubCategory ||
              found.sub_sub_category ||
              "",
            image: found.image || found.imageUrl || "",
            visibility: found.visibility || "publish",
            productType: found.productType || "single",
            tags: existingTags,
            attributes: existingAttributes,
            additionalImages: existingAdditional,
            shortDescription: found.highlights || found.shortDescription || "",
            howToUse:
              found.howToUse ||
              found.how_to_use ||
              found.usage ||
              found.instructions ||
              "",
            selectedCategories: Array.isArray(found.selectedCategories)
              ? found.selectedCategories
              : found.category
                ? [found.category]
                : [],
            manageStock: found.manageStock !== false,
            onSale: Boolean(found.onSale),
            salePrice: found.salePrice || "",
            variableOptions: found.variableOptions || "",
            showInStartFirstOrder: Boolean(
              found.showInStartFirstOrder ||
                found.showInHotDeals ||
                hasLegacy(["hot_deals", "start_first_order"])
            ),
            showInRecommendedSalon: Boolean(found.showInRecommendedSalon || found.isRecommended || hasLegacy(["recommended_salon", "recommended"])),
            showInMostBought: Boolean(found.showInMostBought || hasLegacy(["most_bought", "most_bought_products", "bestseller"])),
            showInPopularProducts: Boolean(found.showInPopularProducts || found.isPopular || hasLegacy(["popular_products", "popular"])),
          });
          if (found.image || found.imageUrl) setImagePreview(found.image || found.imageUrl);

          getProductVariants(found.id).then((variants) => {
            const mapped = variants.map((v) => ({
              variantDocId: v.id,
              variantKey: makeVariantId(v.attribute || "variant", v.value || ""),
              attribute: (v.attribute || "variant").toString(),
              value: (v.value || "").toString(),
              sku: (v.sku || "").toString(),
              price: (v.price ?? "").toString(),
              regularPrice: (v.regularPrice ?? "").toString(),
              salePrice: (v.salePrice ?? "").toString(),
              stock: (v.stock ?? "").toString(),
              colorCode: (v.colorCode || "").toString(),
              image: (v.image || "").toString(),
            }));
            setVariantRows(mapped);
            setExistingVariantIds(mapped.map((v) => v.variantDocId).filter(Boolean));
          }).catch(() => {
            setVariantRows([]);
            setExistingVariantIds([]);
          });
        }
      });
    }
  }, [id]);

  useEffect(() => {
    if (!form.category) return;
    const selected = subCategories.find((s) => s.name === form.subCategory);
    if (!selected) {
      setForm((f) => ({ ...f, subCategory: "", subSubCategory: "" }));
    }
  }, [form.category, form.subCategory, subCategories]);

  useEffect(() => {
    if (!form.subCategory) return;
    const selected = subSubCategories.find(
      (s) =>
        s.name === form.subSubCategory &&
        (s.parentCategory || "") === (form.category || "") &&
        (s.parentSubCategory || "") === (form.subCategory || "")
    );
    if (!selected) {
      setForm((f) => ({ ...f, subSubCategory: "" }));
    }
  }, [form.category, form.subCategory, form.subSubCategory, subSubCategories]);

  useEffect(() => {
    setVariantRows((prev) => deriveVariantRows(prev));
  }, [
    form.productType,
    form.attributes,
    form.price,
    form.originalPrice,
    form.salePrice,
    form.stock,
  ]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const applyDescriptionFormat = (action) => {
    const el = descriptionEditorRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const source = form.description || "";
    const selected = source.slice(start, end);

    const fallback = {
      bold: "bold text",
      italic: "italic text",
      underline: "underlined text",
      h1: "Heading",
      list: "List item",
      link: "link text",
      align: "aligned text",
    };

    const picked = selected || fallback[action] || "text";
    let next = source;
    let nextStart = start;
    let nextEnd = end;

    const replaceRange = (replacement, cursorFrom = 0, cursorTo = replacement.length) => {
      next = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
      nextStart = start + cursorFrom;
      nextEnd = start + cursorTo;
    };

    if (action === "bold") {
      const out = `**${picked}**`;
      replaceRange(out, 2, 2 + picked.length);
    } else if (action === "italic") {
      const out = `*${picked}*`;
      replaceRange(out, 1, 1 + picked.length);
    } else if (action === "underline") {
      const out = `__${picked}__`;
      replaceRange(out, 2, 2 + picked.length);
    } else if (action === "h1") {
      const out = `# ${picked}`;
      replaceRange(out, 2, 2 + picked.length);
    } else if (action === "list") {
      const lines = picked
        .split("\n")
        .map((line) => (line.trim().startsWith("- ") ? line : `- ${line}`))
        .join("\n");
      replaceRange(lines);
    } else if (action === "link") {
      const out = `[${picked}](https://)`;
      replaceRange(out, picked.length + 3, picked.length + 11);
    } else if (action === "align") {
      const out = `[align:center]${picked}[/align]`;
      replaceRange(out, 14, 14 + picked.length);
    }

    set("description", next);

    requestAnimationFrame(() => {
      if (!descriptionEditorRef.current) return;
      descriptionEditorRef.current.focus();
      descriptionEditorRef.current.setSelectionRange(nextStart, nextEnd);
    });
  };

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
    const parent = (form.category || "").trim();

    if (!name) {
      toast.error("Sub-category name is required");
      return;
    }

    if (!parent) {
      toast.error("Please select a parent category");
      return;
    }

    const duplicate = subCategories.some(
      (s) =>
        (s.name || "").toLowerCase() === name.toLowerCase() &&
        (s.parentCategory || "").toLowerCase() === parent.toLowerCase()
    );
    if (duplicate) {
      toast.warning("Sub-category already exists under selected parent");
      return;
    }

    try {
      await addSubCategory({
        name,
        parentCategory: parent,
      });
      const allSubCategories = await getSubCategories();
      setSubCategories(allSubCategories);
      set("category", parent);
      set("subCategory", name);
      setNewCategoryName("");
      toast.success("Sub-category added");
    } catch {
      toast.error("Failed to add sub-category");
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
    const next = [...form.tags, value];
    set("tags", next);
    set("tag", next[0] || "");
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

  const addAttributeFromGlobal = () => {
    if (!selectedGlobalAttr) { toast.warning("Select an attribute first"); return; }
    if (form.attributes.some((a) => a.name.toLowerCase() === selectedGlobalAttr.name.toLowerCase())) {
      toast.warning(`${selectedGlobalAttr.name} is already added`);
      return;
    }
    const valuesToAdd = chosenAttrValues.length > 0 ? chosenAttrValues : (selectedGlobalAttr.values || []);
    set("attributes", [
      ...form.attributes,
      {
        name: selectedGlobalAttr.name,
        isColorField: selectedGlobalAttr.isColorField || false,
        values: valuesToAdd,
        useForVariations: true,
      },
    ]);
    setSelectedGlobalAttr(null);
    setChosenAttrValues([]);
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

  const variationAttribute = form.attributes.find((a) => a.useForVariations !== false);
  const variationAttributeName = variationAttribute?.name || "";
  const variationValues = Array.isArray(variationAttribute?.values)
    ? variationAttribute.values.filter((v) => String(v).trim())
    : [];

  const makeVariantId = (attributeName, value) => `${normalizeAttr(attributeName)}::${normalizeAttr(value)}`;

  const deriveVariantRows = (prevRows = []) => {
    if (form.productType !== "variable" || !variationAttributeName || variationValues.length === 0) {
      return [];
    }

    return variationValues.map((rawValue) => {
      const value = String(rawValue).trim();
      const variantKey = makeVariantId(variationAttributeName, value);
      const prev = prevRows.find((row) => row.variantKey === variantKey);
      return prev || {
        variantKey,
        attribute: normalizeAttr(variationAttributeName),
        value,
        sku: "",
        price: form.price || "",
        regularPrice: form.originalPrice || "",
        salePrice: form.salePrice || "",
        stock: form.stock || "",
        colorCode: "",
        image: "",
      };
    });
  };

  const updateVariantRow = (variantKey, field, value) => {
    setVariantRows((rows) => rows.map((row) => (
      row.variantKey === variantKey ? { ...row, [field]: value } : row
    )));
  };

  const validateVariants = () => {
    if (form.productType !== "variable") return true;
    if (!variationAttributeName || variationValues.length === 0) {
      toast.error("Add at least one attribute with values for variable products");
      return false;
    }

    const skuSet = new Set();
    for (const row of variantRows) {
      if (!row.sku.trim()) {
        toast.error(`SKU is required for ${row.value}`);
        return false;
      }
      if (skuSet.has(row.sku.trim().toLowerCase())) {
        toast.error("Each variant SKU must be unique");
        return false;
      }
      skuSet.add(row.sku.trim().toLowerCase());

      if (!row.price) {
        toast.error(`Price is required for ${row.value}`);
        return false;
      }
      if (row.stock === "" || row.stock === null || row.stock === undefined) {
        toast.error(`Stock is required for ${row.value}`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Product name is required"); return; }
    if (!form.price)        { toast.error("Price is required"); return; }
    if (!validateVariants()) return;

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
      const mergedHighlights = [
        form.shortDescription || "",
        ...shortMediaUrls.map((url) => `![media](${url})`),
      ]
        .filter(Boolean)
        .join("\n");
      const pendingTag = tagInput.trim().toLowerCase();
      const finalTags = Array.from(
        new Set([
          ...(form.tags || []),
          ...(pendingTag ? [pendingTag] : []),
        ])
      );
      const homeSections = [
        form.showInStartFirstOrder ? "hot_deals" : "",
        form.showInStartFirstOrder ? "start_first_order" : "",
        form.showInRecommendedSalon ? "recommended_salon" : "",
        form.showInMostBought ? "most_bought" : "",
        form.showInPopularProducts ? "popular_products" : "",
      ].filter(Boolean);
      const inlineVariants = form.productType === "variable"
        ? variantRows.map((row) => ({
            id: row.variantKey,
            attribute: row.attribute || normalizeAttr(variationAttributeName || "variant"),
            value: row.value,
            shadeName: row.value,
            sku: row.sku.trim(),
            price: Number(row.price) || 0,
            regularPrice: Number(row.regularPrice) || 0,
            salePrice: Number(row.salePrice) || 0,
            stock: Number(row.stock) || 0,
            colorCode: row.colorCode || "",
            image: row.image || "",
          }))
        : [];
      const data = {
        ...form,
        shortDescription: mergedHighlights,
        highlights: mergedHighlights,
        howToUse: form.howToUse || "",
        how_to_use: form.howToUse || "",
        usage: form.howToUse || "",
        category: form.selectedCategories[0] || form.category || "",
        selectedCategories: form.selectedCategories || [],
        subCategory: form.subCategory || "",
        subcategory: form.subCategory || "",
        subSubCategory: form.subSubCategory || "",
        subsubCategory: form.subSubCategory || "",
        sub_sub_category: form.subSubCategory || "",
        categoryPathNames: [
          form.selectedCategories[0] || form.category || "",
          form.subCategory || "",
          form.subSubCategory || "",
        ].filter(Boolean),
        description: mergedDescription,
        price:         Number(form.price)         || 0,
        originalPrice: Number(form.originalPrice) || 0,
        salePrice:     Number(form.salePrice)      || 0,
        rating:        Number(form.rating)         || 0,
        reviews:       Number(form.reviews)        || 0,
        stock:         form.manageStock ? Number(form.stock) || 0 : 0,
        image: imageUrl,
        imageUrl: imageUrl,
        tags: finalTags,
        tag: finalTags[0] || form.tag || "",
        additionalImages: mergedAdditionalImages,
        attributes: form.attributes || [],
        showInStartFirstOrder: Boolean(form.showInStartFirstOrder),
        showInHotDeals: Boolean(form.showInStartFirstOrder),
        showInRecommendedSalon: Boolean(form.showInRecommendedSalon),
        showInMostBought: Boolean(form.showInMostBought),
        showInPopularProducts: Boolean(form.showInPopularProducts),
        isRecommended: Boolean(form.showInRecommendedSalon),
        isPopular: Boolean(form.showInPopularProducts),
        homeSection: homeSections[0] || form.homeSection || "",
        homeSections,
        variants: inlineVariants,
      };
      let productId = id;
      if (isEdit) {
        await updateProduct(id, data);
        productId = id;
        toast.success("Product updated!");
      } else {
        const created = await createProduct(data);
        productId = created.id;
        toast.success("Product added!");
      }

      if (form.productType === "variable" && productId) {
        const keptDocIds = new Set();
        for (const row of variantRows) {
          const payload = {
            attribute: row.attribute || normalizeAttr(variationAttributeName || "variant"),
            value: row.value,
            sku: row.sku.trim(),
            price: Number(row.price) || 0,
            regularPrice: Number(row.regularPrice) || 0,
            salePrice: Number(row.salePrice) || 0,
            stock: Number(row.stock) || 0,
            colorCode: row.colorCode || "",
            image: row.image || "",
          };
          const created = await createVariant(productId, payload);
          keptDocIds.add(created.id);
        }

        if (isEdit && existingVariantIds.length > 0) {
          const stale = existingVariantIds.filter((docId) => !keptDocIds.has(docId));
          await Promise.all(stale.map((docId) => deleteProductVariant(productId, docId)));
        }
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

  const preventImplicitSubmitOnEnter = (e) => {
    if (e.key !== "Enter") return;

    const tagName = e.target?.tagName?.toLowerCase();
    const type = e.target?.type?.toLowerCase();
    const isTextarea = tagName === "textarea";
    const isButton = tagName === "button" || type === "submit" || type === "button";

    if (isTextarea || isButton) return;

    e.preventDefault();
  };

  return (
    <div className="product-editor-page">
      <div className="product-editor-header">
        <button type="button" className="product-back-btn" onClick={() => navigate("/products")}>
          <MdArrowBack />
        </button>
        <h1>{isEdit ? "Edit Product" : "Create Product"}</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        onKeyDown={preventImplicitSubmitOnEnter}
        className="product-editor-layout"
      >
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
              <button type="button" onClick={() => applyDescriptionFormat("bold")}>B</button>
              <button type="button" onClick={() => applyDescriptionFormat("italic")}>I</button>
              <button type="button" onClick={() => applyDescriptionFormat("underline")}>U</button>
              <button type="button" onClick={() => applyDescriptionFormat("h1")}>H1</button>
              <button type="button" onClick={() => applyDescriptionFormat("list")}>List</button>
              <button type="button" onClick={() => applyDescriptionFormat("link")}>Link</button>
              <button type="button" onClick={() => applyDescriptionFormat("align")}>Align</button>
            </div>
            <textarea
              ref={descriptionEditorRef}
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
                <h4>Product Highlights</h4>
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
                placeholder="Write key highlights..."
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

              <div style={{ marginTop: 12 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>How to use</h4>
                <textarea
                  className="pe-short-desc"
                  placeholder="Write usage instructions (step-by-step)..."
                  value={form.howToUse}
                  onChange={(e) => set("howToUse", e.target.value)}
                />
              </div>
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

            <div className="pe-variable-box" style={{ marginTop: 8 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Show product in home sections
              </label>
              <div className="pe-inline-group pe-feature-row" style={{ marginBottom: 0 }}>
                <label className="pe-check">
                  <input
                    type="checkbox"
                    checked={form.showInStartFirstOrder}
                    onChange={(e) => set("showInStartFirstOrder", e.target.checked)}
                  />
                  Hot Deals
                </label>
                <label className="pe-check">
                  <input
                    type="checkbox"
                    checked={form.showInRecommendedSalon}
                    onChange={(e) => set("showInRecommendedSalon", e.target.checked)}
                  />
                  Recommended for your salon
                </label>
                <label className="pe-check">
                  <input
                    type="checkbox"
                    checked={form.showInMostBought}
                    onChange={(e) => set("showInMostBought", e.target.checked)}
                  />
                  Most Bought Products
                </label>
                <label className="pe-check">
                  <input
                    type="checkbox"
                    checked={form.showInPopularProducts}
                    onChange={(e) => set("showInPopularProducts", e.target.checked)}
                  />
                  Popular Products
                </label>
              </div>
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

            {/* ── Attribute Selector ───────────────────────── */}
            <div className="pa-selector-row">
              <div className="pa-dropdown-col">
                <label className="pa-dropdown-label">Select Attribute</label>
                <select
                  className="pa-attr-select"
                  value={selectedGlobalAttr?.id || ""}
                  onChange={(e) => {
                    const found = globalAttributes.find((a) => a.id === e.target.value);
                    setSelectedGlobalAttr(found || null);
                    setChosenAttrValues([]);
                  }}
                >
                  <option value="">Select Attribute</option>
                  {globalAttributes.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {selectedGlobalAttr && (
                <div className="pa-values-panel">
                  <p className="pa-values-panel-label">Choose Attribute Values</p>
                  <div className="pa-values-grid">
                    {selectedGlobalAttr.isColorField
                      ? (selectedGlobalAttr.values || []).map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            className={`pa-color-swatch ${chosenAttrValues.includes(hex) ? "pa-swatch-on" : ""}`}
                            style={{ background: hex }}
                            onClick={() =>
                              setChosenAttrValues((prev) =>
                                prev.includes(hex) ? prev.filter((x) => x !== hex) : [...prev, hex]
                              )
                            }
                            title={hex}
                          />
                        ))
                      : (selectedGlobalAttr.values || []).map((val) => (
                          <button
                            key={val}
                            type="button"
                            className={`pa-value-chip ${chosenAttrValues.includes(val) ? "pa-chip-on" : ""}`}
                            onClick={() =>
                              setChosenAttrValues((prev) =>
                                prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
                              )
                            }
                          >
                            {val}
                          </button>
                        ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary pa-add-attr-btn"
                onClick={addAttributeFromGlobal}
                disabled={!selectedGlobalAttr}
              >
                <MdAdd /> Add Attribute
              </button>
            </div>

            {/* ── All Attributes (added) ───────────────────── */}
            <div className="pa-all-attributes-section">
              <h4 className="pa-all-attrs-title">All Attributes</h4>
              <div className="pa-all-attrs-box">
                {form.attributes.length === 0 ? (
                  <p className="pa-empty-text">There are no attributes added for this product</p>
                ) : (
                  form.attributes.map((attr) => (
                    <div className="pa-added-attr-row" key={attr.name}>
                      <div className="pa-added-attr-name">{attr.name}</div>
                      <div className="pa-added-attr-values">
                        {attr.isColorField
                          ? (attr.values || []).map((hex) => (
                              <span
                                key={hex}
                                className="pa-display-swatch"
                                style={{ background: hex }}
                                title={hex}
                              />
                            ))
                          : (attr.values || []).map((val) => (
                              <span key={val} className="pa-display-chip">{val}</span>
                            ))}
                      </div>
                      <label className="pe-check" style={{ marginLeft: "auto" }}>
                        <input
                          type="checkbox"
                          checked={attr.useForVariations !== false}
                          onChange={(e) => toggleAttributeVariation(attr.name, e.target.checked)}
                        />
                        Use for variations
                      </label>
                      <button
                        type="button"
                        className="pe-delete-btn"
                        onClick={() => removeAttribute(attr.name)}
                        style={{ marginLeft: 8 }}
                      >
                        <MdDeleteOutline />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {form.productType === "variable" && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ marginBottom: 8 }}>Variant Configuration</h4>
                {!variationAttributeName || variationValues.length === 0 ? (
                  <p className="text-muted">Select an attribute and add values to generate variants.</p>
                ) : (
                  <div className="table-wrap pe-variant-table-wrap">
                    <table className="pe-variant-table">
                      <thead>
                        <tr>
                          <th>Value</th>
                          <th>SKU</th>
                          <th>Price</th>
                          <th>Regular Price</th>
                          <th>Sale Price</th>
                          <th>Stock</th>
                          <th>Color Code</th>
                          <th>Image URL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variantRows.map((row) => (
                          <tr key={row.variantKey}>
                            <td>
                              {variationAttribute?.isColorField ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ display: "inline-block", width: 24, height: 24, borderRadius: "50%", background: row.value, border: "1px solid #e2e8f0", flexShrink: 0 }} />
                                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{row.value}</span>
                                </div>
                              ) : row.value}
                            </td>
                            <td>
                              <input
                                className="pe-input pe-variant-sku-input"
                                value={row.sku}
                                onChange={(e) => updateVariantRow(row.variantKey, "sku", e.target.value)}
                                placeholder="SKU"
                              />
                            </td>
                            <td>
                              <input
                                className="pe-input"
                                type="number"
                                min="0"
                                value={row.price}
                                onChange={(e) => updateVariantRow(row.variantKey, "price", e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="pe-input"
                                type="number"
                                min="0"
                                value={row.regularPrice}
                                onChange={(e) => updateVariantRow(row.variantKey, "regularPrice", e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="pe-input"
                                type="number"
                                min="0"
                                value={row.salePrice}
                                onChange={(e) => updateVariantRow(row.variantKey, "salePrice", e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="pe-input"
                                type="number"
                                min="0"
                                value={row.stock}
                                onChange={(e) => updateVariantRow(row.variantKey, "stock", e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="pe-input"
                                value={row.colorCode}
                                onChange={(e) => updateVariantRow(row.variantKey, "colorCode", e.target.value)}
                                placeholder="#000000"
                              />
                            </td>
                            <td>
                              <input
                                className="pe-input"
                                value={row.image}
                                onChange={(e) => updateVariantRow(row.variantKey, "image", e.target.value)}
                                placeholder="https://..."
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
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
            <div className="pe-category-controls">
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
                onChange={(e) => {
                  set("subCategory", e.target.value);
                  set("subSubCategory", "");
                }}
                disabled={!form.category}
              >
                <option value="">Select sub category</option>
                {subCategories
                  .filter((s) => !form.category || s.parentCategory === form.category)
                  .map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
              </select>

              <select
                value={form.subSubCategory || ""}
                onChange={(e) => set("subSubCategory", e.target.value)}
                disabled={!form.category || !form.subCategory}
              >
                <option value="">Select sub sub category</option>
                {subSubCategories
                  .filter(
                    (s) =>
                      (!form.category || s.parentCategory === form.category) &&
                      (!form.subCategory || s.parentSubCategory === form.subCategory)
                  )
                  .map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
              </select>

              {form.selectedCategories.length === 0 && <p className="text-muted">There are no Categories selected</p>}

              <div className="pe-inline-add pe-category-add">
                <input
                  className="pe-input"
                  placeholder="Add new sub category"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={createCategory}
                  disabled={!form.category}
                  title={!form.category ? "Select a parent category first" : "Add sub-category"}
                >
                  Add
                </button>
              </div>
              <p className="text-muted">
                Main categories are managed from the Categories page. Select one parent category above, then add sub-categories here.
              </p>
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
                  <button
                    type="button"
                    onClick={() => {
                      const next = form.tags.filter((t) => t !== tag);
                      set("tags", next);
                      set("tag", next[0] || "");
                    }}
                  >
                    x
                  </button>
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


