import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  MdAdd, MdEdit, MdDeleteOutline, MdSearch, MdFileDownload, MdPrint,
  MdOutlineCategory,
} from "react-icons/md";
import { getAttributes, updateAttribute, deleteAttribute } from "../../firestoreService";
import ConfirmDialog from "../../components/ConfirmDialog";

function formatDate(ts) {
  if (!ts) return "—";
  let d;
  if (ts?.toDate) d = ts.toDate();
  else d = new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " at " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function AttributesList() {
  const navigate = useNavigate();
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setAttributes(await getAttributes()); }
    catch { toast.error("Failed to load attributes"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleStatus = async (attr) => {
    const next = attr.status === "active" ? "inactive" : "active";
    try {
      await updateAttribute(attr.id, { status: next });
      setAttributes((prev) => prev.map((a) => a.id === attr.id ? { ...a, status: next } : a));
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAttribute(deleteTarget);
      toast.success("Attribute deleted");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  const filtered = attributes.filter((a) =>
    (a.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-content">
      {deleteTarget && (
        <ConfirmDialog
          message="Delete this attribute? Products using it may be affected."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="page-header-icon">
            <MdOutlineCategory />
          </div>
          <h1 className="page-title">All Attributes</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-icon btn-outline" title="Download">
            <MdFileDownload />
          </button>
          <button className="btn btn-icon btn-outline" title="Print">
            <MdPrint />
          </button>
        </div>
      </div>

      <div className="attr-top-bar">
        <button
          className="btn btn-primary"
          onClick={() => navigate("/attributes/create")}
        >
          <MdAdd /> Create New Attribute
        </button>
      </div>

      <div className="attr-search-bar">
        <MdSearch className="attr-search-icon" />
        <input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="attr-search-input"
        />
      </div>

      <div className="card table-wrap" style={{ marginTop: 16 }}>
        {loading ? (
          <div className="text-muted" style={{ padding: 24 }}>Loading…</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input type="checkbox" />
                </th>
                <th>Ser</th>
                <th>Attribute ↑</th>
                <th>Values</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 32 }}>
                    No attributes found.
                  </td>
                </tr>
              )}
              {filtered.map((attr, i) => (
                <tr key={attr.id}>
                  <td><input type="checkbox" /></td>
                  <td>{i + 1}</td>
                  <td>
                    <button
                      className="attr-name-link"
                      type="button"
                      onClick={() => navigate(`/attributes/edit/${attr.id}`)}
                    >
                      {attr.name}
                    </button>
                  </td>
                  <td>
                    {attr.isColorField ? (
                      <div className="attr-swatch-row">
                        {(attr.values || []).map((hex) => (
                          <span
                            key={hex}
                            className="attr-swatch-circle"
                            style={{ background: hex }}
                            title={hex}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted" style={{ fontSize: 13 }}>
                        {(attr.values || []).join(", ") || "—"}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`attr-status-toggle ${attr.status === "active" ? "active" : ""}`}
                      onClick={() => toggleStatus(attr)}
                      title={attr.status === "active" ? "Click to deactivate" : "Click to activate"}
                    >
                      <span className="attr-toggle-label">
                        {attr.status === "active" ? "Active" : "Inactive"}
                      </span>
                      <span className="attr-toggle-knob" />
                    </button>
                  </td>
                  <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                    {formatDate(attr.createdAt)}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn btn-icon btn-outline"
                        type="button"
                        onClick={() => navigate(`/attributes/edit/${attr.id}`)}
                        title="Edit"
                      >
                        <MdEdit />
                      </button>
                      <button
                        className="btn btn-icon"
                        type="button"
                        style={{ background: "#fee2e2", color: "#dc2626" }}
                        onClick={() => setDeleteTarget(attr.id)}
                        title="Delete"
                      >
                        <MdDeleteOutline />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
