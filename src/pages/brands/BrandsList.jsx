import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { MdAdd, MdEdit, MdDelete, MdBrandingWatermark, MdClose } from "react-icons/md";
import {
  getBrands, addBrand, updateBrand, deleteBrand,
} from "../../firestoreService";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebaseConfig";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useClipboardFilePaste } from "../../utils/useClipboardFilePaste";

const emptyForm = { name: "", image: "" };

export default function BrandsList() {
  const [brands, setBrands] = useState([]);
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
    try { setBrands(await getBrands()); }
    catch { toast.error("Failed to load brands"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm(emptyForm); setEditId(null);
    setImageFile(null); setImagePreview(null);
    setShowModal(true);
  };

  const openEdit = (b) => {
    setForm({ name: b.name, image: b.image || "" });
    setEditId(b.id);
    setImageFile(null);
    setImagePreview(b.image || null);
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
      toast.success("Logo pasted from clipboard");
    },
  });

  const uploadImage = async () => {
    if (!imageFile) return form.image || "";
    const storageRef = ref(storage, `brands/${Date.now()}_${imageFile.name}`);
    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, imageFile);
      task.on("state_changed", null, reject, () =>
        getDownloadURL(task.snapshot.ref).then(resolve)
      );
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Brand name is required"); return; }
    setSaving(true);
    try {
      const imageUrl = await uploadImage();
      const data = { name: form.name.trim(), image: imageUrl };
      if (editId) {
        await updateBrand(editId, data);
        toast.success("Brand updated!");
      } else {
        await addBrand(data);
        toast.success("Brand added!");
      }
      setShowModal(false);
      load();
    } catch {
      toast.error("Failed to save brand");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteBrand(deleteTarget);
      toast.success("Brand deleted");
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
          title="Delete Brand?"
          message="This brand will be permanently removed."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editId ? "Edit Brand" : "Add Brand"}</span>
              <button className="modal-close" onClick={() => setShowModal(false)}><MdClose /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-grid single">
                <div className="form-group">
                  <label>Brand Logo</label>
                  <div className="img-upload" onClick={() => fileRef.current.click()}>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} />
                    {imagePreview ? (
                      <img src={imagePreview} className="img-preview" alt="preview" />
                    ) : (
                      <MdBrandingWatermark style={{ fontSize: 36, color: "var(--text-secondary)" }} />
                    )}
                    <div className="img-upload-label"><span>Upload logo</span></div>
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
                  <label>Brand Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Schwarzkopf"
                    required
                  />
                </div>
              </div>
              <div className="form-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : editId ? "Update" : "Add Brand"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h2>Brands</h2>
          <div className="breadcrumb">Home / <span>Brands</span></div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <MdAdd /> Add Brand
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">All Brands ({brands.length})</span>
        </div>

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : brands.length === 0 ? (
          <div className="empty-state">
            <MdBrandingWatermark />
            <p>No brands yet. Add your first brand.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Logo</th>
                  <th>Brand Name</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b, i) => (
                  <tr key={b.id}>
                    <td className="text-muted">{i + 1}</td>
                    <td>
                      {b.image ? (
                        <img src={b.image} alt={b.name} className="table-img" />
                      ) : (
                        <div className="no-img"><MdBrandingWatermark /></div>
                      )}
                    </td>
                    <td className="font-medium">{b.name}</td>
                    <td className="text-muted">
                      {b.createdAt?.toDate
                        ? b.createdAt.toDate().toLocaleDateString()
                        : "—"}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-warning btn-sm btn-icon" onClick={() => openEdit(b)}>
                          <MdEdit />
                        </button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteTarget(b.id)}>
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
