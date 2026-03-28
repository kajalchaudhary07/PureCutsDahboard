import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  MdAdd,
  MdEdit,
  MdDelete,
  MdCategory,
  MdClose,
  MdSort,
} from "react-icons/md";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import {
  getSubSubCategories,
  addSubSubCategory,
  updateSubSubCategory,
  deleteSubSubCategory,
  getCategories,
  getSubCategories,
} from "../../firestoreService";
import { storage } from "../../firebaseConfig";
import ConfirmDialog from "../../components/ConfirmDialog";

const emptyForm = {
  name: "",
  parentCategory: "",
  parentSubCategory: "",
  image: "",
};

export default function SubSubCategoriesList() {
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterSubCategory, setFilterSubCategory] = useState("All");
  const [sortBy, setSortBy] = useState("name_asc");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const [ss, cats, subs] = await Promise.all([
        getSubSubCategories(),
        getCategories(),
        getSubCategories(),
      ]);
      setRows(ss);
      setCategories(cats);
      setSubCategories(subs);
    } catch {
      toast.error("Failed to load sub-sub-categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!form.parentCategory) return;
    const validParentSub = subCategories.some(
      (s) =>
        s.name === form.parentSubCategory &&
        (s.parentCategory || "") === form.parentCategory
    );
    if (!validParentSub) {
      setForm((prev) => ({ ...prev, parentSubCategory: "" }));
    }
  }, [form.parentCategory, form.parentSubCategory, subCategories]);

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setImageFile(null);
    setImagePreview(null);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setForm({
      name: item.name || "",
      parentCategory: item.parentCategory || "",
      parentSubCategory: item.parentSubCategory || "",
      image: item.image || "",
    });
    setEditId(item.id);
    setImageFile(null);
    setImagePreview(item.image || null);
    setShowModal(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async () => {
    if (!imageFile) return form.image || "";
    const storageRef = ref(
      storage,
      `subSubCategories/${Date.now()}_${imageFile.name}`
    );
    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, imageFile);
      task.on("state_changed", null, reject, () =>
        getDownloadURL(task.snapshot.ref).then(resolve)
      );
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error("Sub-sub-category name is required");
      return;
    }
    if (!form.parentCategory) {
      toast.error("Please choose a parent category");
      return;
    }
    if (!form.parentSubCategory) {
      toast.error("Please choose a parent sub-category");
      return;
    }

    setSaving(true);
    try {
      const imageUrl = await uploadImage();
      const payload = {
        name,
        parentCategory: form.parentCategory,
        parentSubCategory: form.parentSubCategory,
        image: imageUrl,
      };

      if (editId) {
        await updateSubSubCategory(editId, payload);
        toast.success("Sub-sub-category updated!");
      } else {
        const duplicate = rows.some(
          (row) =>
            (row.name || "").toLowerCase() === name.toLowerCase() &&
            (row.parentCategory || "").toLowerCase() ===
              form.parentCategory.toLowerCase() &&
            (row.parentSubCategory || "").toLowerCase() ===
              form.parentSubCategory.toLowerCase()
        );

        if (duplicate) {
          toast.warning("Sub-sub-category already exists under this parent");
          setSaving(false);
          return;
        }

        await addSubSubCategory(payload);
        toast.success("Sub-sub-category added!");
      }

      setShowModal(false);
      load();
    } catch (error) {
      const msg =
        error?.message?.replace("Firebase: ", "") ||
        "Failed to save sub-sub-category";
      console.error("[SubSubCategories] Save failed:", error);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteSubSubCategory(deleteTarget);
      toast.success("Sub-sub-category deleted");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  const getCreatedAtMs = (row) => {
    const raw = row?.createdAt ?? row?.updatedAt ?? null;
    if (!raw) return 0;
    if (typeof raw?.toDate === "function") {
      const d = raw.toDate();
      return Number.isFinite(d?.getTime?.()) ? d.getTime() : 0;
    }
    if (raw instanceof Date) {
      return Number.isFinite(raw.getTime()) ? raw.getTime() : 0;
    }
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d.getTime() : 0;
  };

  const categoryNames = [
    "All",
    ...Array.from(new Set(categories.map((c) => String(c.name || "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    ),
  ];

  const availableSubCategoryNames = [
    "All",
    ...Array.from(
      new Set(
        subCategories
          .filter(
            (s) => filterCategory === "All" || s.parentCategory === filterCategory
          )
          .map((s) => String(s.name || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
  ];

  const filtered = useMemo(() => {
    const list = rows.filter((row) => {
      const byCategory =
        filterCategory === "All" || row.parentCategory === filterCategory;
      const bySub =
        filterSubCategory === "All" || row.parentSubCategory === filterSubCategory;
      return byCategory && bySub;
    });

    list.sort((a, b) => {
      if (sortBy === "name_desc") {
        return String(b.name || "").localeCompare(String(a.name || ""), undefined, {
          sensitivity: "base",
        });
      }
      if (sortBy === "oldest") {
        return getCreatedAtMs(a) - getCreatedAtMs(b);
      }
      if (sortBy === "newest") {
        return getCreatedAtMs(b) - getCreatedAtMs(a);
      }

      const aCat = String(a.parentCategory || "");
      const bCat = String(b.parentCategory || "");
      const catCmp = aCat.localeCompare(bCat, undefined, { sensitivity: "base" });
      if (catCmp !== 0) return catCmp;

      const aSub = String(a.parentSubCategory || "");
      const bSub = String(b.parentSubCategory || "");
      const subCmp = aSub.localeCompare(bSub, undefined, { sensitivity: "base" });
      if (subCmp !== 0) return subCmp;

      return String(a.name || "").localeCompare(String(b.name || ""), undefined, {
        sensitivity: "base",
      });
    });

    return list;
  }, [filterCategory, filterSubCategory, rows, sortBy]);

  const modalSubCategories = subCategories.filter(
    (s) => !form.parentCategory || s.parentCategory === form.parentCategory
  );

  return (
    <>
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Sub-Sub-Category?"
          message="This sub-sub-category will be permanently removed."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                {editId ? "Edit Sub-Sub-Category" : "Add Sub-Sub-Category"}
              </span>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <MdClose />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-grid single">
                <div className="form-group">
                  <label>Icon / Image</label>
                  <div className="img-upload" onClick={() => fileRef.current.click()}>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                    {imagePreview ? (
                      <img src={imagePreview} className="img-preview" alt="preview" />
                    ) : (
                      <MdCategory style={{ fontSize: 36, color: "var(--text-secondary)" }} />
                    )}
                    <div className="img-upload-label"><span>Upload icon</span></div>
                  </div>
                  <input
                    placeholder="Or paste image URL…"
                    value={!imageFile ? form.image : ""}
                    onChange={(e) => {
                      setImageFile(null);
                      setImagePreview(e.target.value || null);
                      setForm((f) => ({ ...f, image: e.target.value }));
                    }}
                    style={{ marginTop: 8 }}
                  />
                </div>

                <div className="form-group">
                  <label>Parent Category *</label>
                  <select
                    value={form.parentCategory}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        parentCategory: e.target.value,
                        parentSubCategory: "",
                      }))
                    }
                    required
                  >
                    <option value="">Select parent category…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Sub-Category (under selected parent) *</label>
                  <select
                    value={form.parentSubCategory}
                    onChange={(e) => setForm((f) => ({ ...f, parentSubCategory: e.target.value }))}
                    required
                    disabled={!form.parentCategory}
                  >
                    <option value="">Select parent sub-category…</option>
                    {modalSubCategories.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Sub-Sub-Category Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Hair Color Gel"
                    required
                  />
                </div>
              </div>

              <div className="form-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : editId ? "Update" : "Add Sub-Sub-Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h2>Sub-Sub-Categories</h2>
          <div className="breadcrumb">Home / <span>Sub Sub Categories</span></div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <MdAdd /> Add Sub-Sub-Category
        </button>
      </div>

      <div
        className="card"
        style={{ marginBottom: 12, padding: 12, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}
      >
        <div>
          <label className="text-muted" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
            Filter by parent category
          </label>
          <select
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setFilterSubCategory("All");
            }}
          >
            {categoryNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-muted" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
            Filter by sub-category
          </label>
          <select
            value={filterSubCategory}
            onChange={(e) => setFilterSubCategory(e.target.value)}
          >
            {availableSubCategoryNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-muted" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
            Sort
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <MdSort style={{ color: "#64748b" }} />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="name_asc">Name (A → Z)</option>
              <option value="name_desc">Name (Z → A)</option>
              <option value="oldest">Oldest → Newest</option>
              <option value="newest">Newest → Oldest</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Sub-Sub-Categories ({filtered.length})</span>
        </div>

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <MdCategory />
            <p>No sub-sub-categories found.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Icon</th>
                  <th>Sub-Sub-Category</th>
                  <th>Parent Category</th>
                  <th>Parent Sub-Category</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={row.id}>
                    <td className="text-muted">{i + 1}</td>
                    <td>
                      {row.image ? (
                        <img src={row.image} alt={row.name} className="table-img" />
                      ) : (
                        <div className="no-img"><MdCategory /></div>
                      )}
                    </td>
                    <td className="font-medium">{row.name}</td>
                    <td>
                      {row.parentCategory ? (
                        <span className="badge badge-blue">{row.parentCategory}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      {row.parentSubCategory ? (
                        <span className="badge badge-gray">{row.parentSubCategory}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-muted">
                      {row.createdAt?.toDate
                        ? row.createdAt.toDate().toLocaleDateString()
                        : "—"}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-warning btn-sm btn-icon" onClick={() => openEdit(row)}>
                          <MdEdit />
                        </button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteTarget(row.id)}>
                          <MdDelete />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
