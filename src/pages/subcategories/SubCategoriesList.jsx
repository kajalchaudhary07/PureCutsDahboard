import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { MdAdd, MdEdit, MdDelete, MdAccountTree, MdClose, MdSort } from "react-icons/md";
import {
  getSubCategories, addSubCategory, updateSubCategory, deleteSubCategory,
  getCategories,
} from "../../firestoreService";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebaseConfig";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useClipboardFilePaste } from "../../utils/useClipboardFilePaste";

const emptyForm = { name: "", parentCategory: "", image: "" };

export default function SubCategoriesList() {
  const [subCats, setSubCats] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [filterCat, setFilterCat] = useState("All");
  const [sortBy, setSortBy] = useState("name_asc");
  const fileRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const [sc, cats] = await Promise.all([getSubCategories(), getCategories()]);
      setSubCats(sc);
      setCategories(cats);
    } catch {
      toast.error("Failed to load sub-categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm(emptyForm); setEditId(null);
    setImageFile(null); setImagePreview(null);
    setShowModal(true);
  };

  const openEdit = (s) => {
    setForm({ name: s.name, parentCategory: s.parentCategory || "", image: s.image || "" });
    setEditId(s.id);
    setImageFile(null);
    setImagePreview(s.image || null);
    setShowModal(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  useClipboardFilePaste({
    enabled: showModal,
    onFiles: (files) => {
      const file = files?.[0];
      if (!file) return;
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      toast.success("Sub-category image pasted from clipboard");
    },
  });

  const uploadImage = async () => {
    if (!imageFile) return form.image || "";
    const storageRef = ref(storage, `subCategories/${Date.now()}_${imageFile.name}`);
    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, imageFile);
      task.on("state_changed", null, reject, () =>
        getDownloadURL(task.snapshot.ref).then(resolve)
      );
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Sub-category name is required"); return; }
    setSaving(true);
    try {
      const imageUrl = await uploadImage();
      const data = {
        name: form.name.trim(),
        parentCategory: form.parentCategory,
        image: imageUrl,
      };
      if (editId) {
        await updateSubCategory(editId, data);
        toast.success("Sub-category updated!");
      } else {
        await addSubCategory(data);
        toast.success("Sub-category added!");
      }
      setShowModal(false);
      load();
    } catch (error) {
      const message = error?.message || "Failed to save sub-category";
      toast.error(message);
      console.error("Failed to save sub-category:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteSubCategory(deleteTarget);
      toast.success("Sub-category deleted");
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

  const catNames = [
    "All",
    ...Array.from(new Set(categories.map((c) => String(c.name || "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    ),
  ];

  const filtered = useMemo(() => {
    const rows =
      filterCat === "All"
        ? [...subCats]
        : subCats.filter((s) => s.parentCategory === filterCat);

    rows.sort((a, b) => {
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
      return String(a.name || "").localeCompare(String(b.name || ""), undefined, {
        sensitivity: "base",
      });
    });

    return rows;
  }, [filterCat, sortBy, subCats]);

  return (
    <>
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Sub-Category?"
          message="This sub-category will be permanently removed."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                {editId ? "Edit Sub-Category" : "Add Sub-Category"}
              </span>
              <button className="modal-close" onClick={() => setShowModal(false)}><MdClose /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-grid single">
                <div className="form-group">
                  <label>Icon / Image</label>
                  <div className="img-upload" onClick={() => fileRef.current.click()}>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} />
                    {imagePreview ? (
                      <img src={imagePreview} className="img-preview" alt="preview" />
                    ) : (
                      <MdAccountTree style={{ fontSize: 36, color: "var(--text-secondary)" }} />
                    )}
                    <div className="img-upload-label"><span>Upload icon</span></div>
                    <div className="img-upload-hint">Tip: Press Ctrl+V to paste copied image</div>
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
                  <label>Sub-Category Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Shampoos"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Parent Category</label>
                  <select
                    value={form.parentCategory}
                    onChange={(e) => setForm((f) => ({ ...f, parentCategory: e.target.value }))}
                  >
                    <option value="">Select parent category…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : editId ? "Update" : "Add Sub-Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h2>Sub-Categories</h2>
          <div className="breadcrumb">Home / <span>Sub Categories</span></div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <MdAdd /> Add Sub-Category
        </button>
      </div>

      {/* Filter tabs by parent category */}
      <div className="filter-row">
        {catNames.map((c) => (
          <button
            key={c}
            className={`filter-tab ${filterCat === c ? "active" : ""}`}
            onClick={() => setFilterCat(c)}
          >
            {c}
          </button>
        ))}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <MdSort style={{ color: "#64748b" }} />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ height: 36, minWidth: 190 }}
            title="Sort sub-categories"
          >
            <option value="name_asc">Sort: Name (A → Z)</option>
            <option value="name_desc">Sort: Name (Z → A)</option>
            <option value="oldest">Sort: Oldest → Newest</option>
            <option value="newest">Sort: Newest → Oldest</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Sub-Categories ({filtered.length})
          </span>
        </div>

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <MdAccountTree />
            <p>No sub-categories found.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Icon</th>
                  <th>Sub-Category Name</th>
                  <th>Parent Category</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id}>
                    <td className="text-muted">{i + 1}</td>
                    <td>
                      {s.image ? (
                        <img src={s.image} alt={s.name} className="table-img" />
                      ) : (
                        <div className="no-img"><MdAccountTree /></div>
                      )}
                    </td>
                    <td className="font-medium">{s.name}</td>
                    <td>
                      {s.parentCategory ? (
                        <span className="badge badge-blue">{s.parentCategory}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-muted">
                      {s.createdAt?.toDate
                        ? s.createdAt.toDate().toLocaleDateString()
                        : "—"}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-warning btn-sm btn-icon" onClick={() => openEdit(s)}>
                          <MdEdit />
                        </button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteTarget(s.id)}>
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
