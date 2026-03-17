import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  MdAdd,
  MdEdit,
  MdDelete,
  MdAdminPanelSettings,
  MdClose,
  MdSearch,
} from "react-icons/md";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebaseConfig";
import {
  getAdmins,
  addAdmin,
  updateAdmin,
  deleteAdmin,
  toggleAdminStatus,
} from "../../firestoreService";
import ConfirmDialog from "../../components/ConfirmDialog";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  role: "admin",
  active: true,
  avatar: "",
};

export default function AdminManagement() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const avatarRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAdmins();
      setAdmins(data);
    } catch (e) {
      toast.error("Failed to load admins");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = admins.filter((admin) => {
    const q = search.toLowerCase();
    return (
      !q ||
      admin.name?.toLowerCase().includes(q) ||
      admin.email?.toLowerCase().includes(q) ||
      admin.phone?.includes(q)
    );
  });

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setAvatarFile(null);
    setAvatarPreview(null);
    setShowModal(true);
  };

  const openEdit = (admin) => {
    setForm({
      name: admin.name || "",
      email: admin.email || "",
      phone: admin.phone || "",
      role: admin.role || "admin",
      active: admin.active !== false,
      avatar: admin.avatar || "",
    });
    setEditId(admin.id);
    setAvatarFile(null);
    setAvatarPreview(admin.avatar || null);
    setShowModal(true);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return form.avatar || "";
    const path = `admins/${Date.now()}_${avatarFile.name}`;
    const storageRef = ref(storage, path);
    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, avatarFile);
      task.on("state_changed", null, reject, () => {
        getDownloadURL(task.snapshot.ref).then(resolve).catch(reject);
      });
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Admin name is required");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Email is required");
      return;
    }

    setSaving(true);
    try {
      const avatarUrl = await uploadAvatar();
      const data = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role,
        active: form.active,
        avatar: avatarUrl,
      };

      if (editId) {
        await updateAdmin(editId, data);
        toast.success("Admin updated!");
      } else {
        await addAdmin(data);
        toast.success("Admin added!");
      }

      setShowModal(false);
      load();
    } catch {
      toast.error("Failed to save admin");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAdmin(deleteTarget);
      toast.success("Admin deleted");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleToggleStatus = async (admin) => {
    try {
      await toggleAdminStatus(admin.id, admin.active);
      toast.success(`Admin ${admin.active ? "deactivated" : "activated"}`);
      load();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const formatDate = (value) => {
    if (!value) return "-";
    if (typeof value?.toDate === "function") return value.toDate().toLocaleDateString();
    if (value instanceof Date) return value.toLocaleDateString();
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleDateString();
  };

  return (
    <>
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Admin?"
          message="This admin will be permanently removed."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editId ? "Edit Admin" : "Create Admin"}</span>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <MdClose />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-grid single">
                <div className="form-group">
                  <label>Admin Avatar</label>
                  <div className="img-upload" onClick={() => avatarRef.current?.click()}>
                    <input
                      ref={avatarRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                    />
                    {avatarPreview ? (
                      <img src={avatarPreview} className="img-preview" alt="avatar" />
                    ) : (
                      <MdAdminPanelSettings style={{ fontSize: 36, color: "var(--text-secondary)" }} />
                    )}
                    <div className="img-upload-label">
                      <span>Upload avatar</span>
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Admin name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="admin@email.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="Phone number"
                  />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  >
                    <option value="admin">Admin</option>
                    <option value="superAdmin">Super Admin</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    />
                    Active
                  </label>
                </div>
              </div>
              <div className="form-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : editId ? "Update Admin" : "Create Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h2>All Admin</h2>
          <div className="breadcrumb">Home / <span>Admin</span></div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={openAdd} style={{ marginBottom: 12 }}>
          <MdAdd /> Create Admin
        </button>

        <div className="search-wrap" style={{ maxWidth: 300 }}>
          <MdSearch />
          <input
            className="search-input"
            placeholder="Search admin…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Admins ({filtered.length})</span>
        </div>

        {loading ? (
          <div className="spinner-wrap">
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <MdAdminPanelSettings />
            <p>No admins found.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ser</th>
                  <th>Admin</th>
                  <th>Email</th>
                  <th>Phone Number</th>
                  <th>Status</th>
                  <th>Register Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((admin, i) => (
                  <tr key={admin.id}>
                    <td className="text-muted">{i + 1}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {admin.avatar ? (
                          <img
                            src={admin.avatar}
                            alt={admin.name}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 6,
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 6,
                              background: "var(--primary)",
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 14,
                              fontWeight: 600,
                            }}
                          >
                            {admin.name?.charAt(0).toUpperCase() || "A"}
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{admin.name || "-"}</div>
                          <div className="text-muted" style={{ fontSize: 11 }}>
                            {admin.role || "Admin"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{admin.email || "-"}</td>
                    <td>{admin.phone || "-"}</td>
                    <td>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={admin.active !== false}
                          onChange={() => handleToggleStatus(admin)}
                        />
                        <span className="slider" />
                      </label>
                    </td>
                    <td className="text-muted">{formatDate(admin.createdAt)}</td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-warning btn-sm btn-icon"
                          onClick={() => openEdit(admin)}
                          title="Edit"
                        >
                          <MdEdit />
                        </button>
                        <button
                          className="btn btn-danger btn-sm btn-icon"
                          onClick={() => setDeleteTarget(admin.id)}
                          title="Delete"
                        >
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
