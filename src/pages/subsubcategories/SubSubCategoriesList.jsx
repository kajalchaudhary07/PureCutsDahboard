import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  MdAdd,
  MdEdit,
  MdDelete,
  MdCategory,
  MdClose,
} from "react-icons/md";
import {
  getSubSubCategories,
  addSubSubCategory,
  updateSubSubCategory,
  deleteSubSubCategory,
  getCategories,
  getSubCategories,
} from "../../firestoreService";
import ConfirmDialog from "../../components/ConfirmDialog";

const emptyForm = {
  name: "",
  parentCategory: "",
  parentSubCategory: "",
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
    setShowModal(true);
  };

  const openEdit = (item) => {
    setForm({
      name: item.name || "",
      parentCategory: item.parentCategory || "",
      parentSubCategory: item.parentSubCategory || "",
    });
    setEditId(item.id);
    setShowModal(true);
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
      const payload = {
        name,
        parentCategory: form.parentCategory,
        parentSubCategory: form.parentSubCategory,
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
    } catch {
      toast.error("Failed to save sub-sub-category");
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

  const categoryNames = ["All", ...categories.map((c) => c.name)];
  const availableSubCategoryNames = [
    "All",
    ...subCategories
      .filter(
        (s) => filterCategory === "All" || s.parentCategory === filterCategory
      )
      .map((s) => s.name),
  ];

  const filtered = rows.filter((row) => {
    const byCategory =
      filterCategory === "All" || row.parentCategory === filterCategory;
    const bySub =
      filterSubCategory === "All" || row.parentSubCategory === filterSubCategory;
    return byCategory && bySub;
  });

  filtered.sort((a, b) => {
    const aCat = (a.parentCategory || "").toString();
    const bCat = (b.parentCategory || "").toString();
    const catCmp = aCat.localeCompare(bCat);
    if (catCmp !== 0) return catCmp;

    const aSub = (a.parentSubCategory || "").toString();
    const bSub = (b.parentSubCategory || "").toString();
    const subCmp = aSub.localeCompare(bSub);
    if (subCmp !== 0) return subCmp;

    return (a.name || "").toString().localeCompare((b.name || "").toString());
  });

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
        style={{ marginBottom: 12, padding: 12, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}
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
