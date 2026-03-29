import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { MdAdd, MdEdit, MdDelete, MdCategory, MdClose } from "react-icons/md";
import {
  getCategories, addCategory, updateCategory, deleteCategory,
} from "../../firestoreService";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebaseConfig";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useClipboardFilePaste } from "../../utils/useClipboardFilePaste";

const emptyForm = { name: "", image: "", order: "" };

export default function CategoriesList() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const data = await getCategories();
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setCategories(data);
    } catch {
      toast.error("Failed to load categories");
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

  const openEdit = (c) => {
    setForm({ name: c.name, image: c.image || "", order: c.order ?? "" });
    setEditId(c.id);
    setImageFile(null);
    setImagePreview(c.image || null);
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
      toast.success("Category image pasted from clipboard");
    },
  });

  const uploadImage = async () => {
    if (!imageFile) return form.image || "";
    const storageRef = ref(storage, `categories/${Date.now()}_${imageFile.name}`);
    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, imageFile);
      task.on("state_changed", null, reject, () =>
        getDownloadURL(task.snapshot.ref).then(resolve)
      );
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Category name is required"); return; }
    setSaving(true);
    try {
      const imageUrl = await uploadImage();
      const data = {
        name: form.name.trim(),
        image: imageUrl,
        order: Number(form.order) || 0,
      };
      if (editId) {
        await updateCategory(editId, data);
        toast.success("Category updated!");
      } else {
        await addCategory(data);
        toast.success("Category added!");
      }
      setShowModal(false);
      load();
    } catch {
      toast.error("Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCategory(deleteTarget);
      toast.success("Category deleted");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <>
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Category?"
          message="This category will be permanently removed."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editId ? "Edit Category" : "Add Category"}</span>
              <button className="modal-close" onClick={() => setShowModal(false)}><MdClose /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-grid single">
                <div className="form-group">
                  <label>Category Icon / Image</label>
                  <div className="img-upload" onClick={() => fileRef.current.click()}>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} />
                    {imagePreview ? (
                      <img src={imagePreview} className="img-preview" alt="preview" />
                    ) : (
                      <MdCategory style={{ fontSize: 36, color: "var(--text-secondary)" }} />
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
                  <label>Category Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Hair Care"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Sort Order</label>
                  <input
                    type="number"
                    min="0"
                    value={form.order}
                    onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="form-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : editId ? "Update" : "Add Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h2>Categories</h2>
          <div className="breadcrumb">Home / <span>Categories</span></div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <MdAdd /> Add Category
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">All Categories ({categories.length})</span>
        </div>

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : categories.length === 0 ? (
          <div className="empty-state">
            <MdCategory />
            <p>No categories yet. Add your first category.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Icon</th>
                  <th>Category Name</th>
                  <th>Sort Order</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c, i) => (
                  <tr key={c.id}>
                    <td className="text-muted">{i + 1}</td>
                    <td>
                      {c.image ? (
                        <img src={c.image} alt={c.name} className="table-img" />
                      ) : (
                        <div className="no-img"><MdCategory /></div>
                      )}
                    </td>
                    <td className="font-medium">{c.name}</td>
                    <td>
                      <span className="badge badge-gray">{c.order ?? 0}</span>
                    </td>
                    <td className="text-muted">
                      {c.createdAt?.toDate
                        ? c.createdAt.toDate().toLocaleDateString()
                        : "—"}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-warning btn-sm btn-icon" onClick={() => openEdit(c)}>
                          <MdEdit />
                        </button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteTarget(c.id)}>
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
