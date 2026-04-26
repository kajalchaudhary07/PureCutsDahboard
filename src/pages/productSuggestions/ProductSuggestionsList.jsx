import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { MdAdd, MdDelete, MdEdit, MdImage, MdSearch } from "react-icons/md";
import ConfirmDialog from "../../components/ConfirmDialog";
import {
  deleteProductSuggestion,
  deleteProductSuggestionImage,
  getProductSuggestionsPaginated,
} from "../../firestoreService";

const STATUS_OPTIONS = ["all", "submitted", "pending", "approved", "rejected"];

const statusLabel = (value) => {
  const clean = String(value || "submitted").trim().toLowerCase();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "Submitted";
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export default function ProductSuggestionsList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const navigate = useNavigate();

  const load = async ({ append = false } = {}) => {
    if (append) {
      if (!hasMore || loadingMore) return;
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const page = await getProductSuggestionsPaginated({
        pageSize: 20,
        cursor: append ? nextCursor : null,
      });
      setRows((prev) => (append ? [...prev, ...page.rows] : page.rows));
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (error) {
      toast.error(error?.message || "Failed to load product suggestions");
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeText(search);
    return rows.filter((row) => {
      const rowStatus = String(row.status || "submitted").trim().toLowerCase();
      const matchStatus = statusFilter === "all" || rowStatus === statusFilter;
      const haystack = normalizeText([
        row.text,
        row.uid,
        row.orderRef,
        row.orderId,
        row.adminNotes,
      ].join(" "));
      const matchSearch = !q || haystack.includes(q);
      return matchStatus && matchSearch;
    });
  }, [rows, search, statusFilter]);

  const totalImages = useMemo(
    () => rows.filter((row) => String(row.imageUrl || "").trim()).length,
    [rows]
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.imagePath) {
        try {
          await deleteProductSuggestionImage(deleteTarget.imagePath);
        } catch {
          // Best-effort cleanup.
        }
      }
      await deleteProductSuggestion(deleteTarget.id);
      setRows((prev) => prev.filter((row) => row.id !== deleteTarget.id));
      toast.success("Product suggestion deleted");
    } catch (error) {
      toast.error(error?.message || "Failed to delete product suggestion");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <>
      {deleteTarget ? (
        <ConfirmDialog
          title="Delete Product Suggestion?"
          message="This will remove the suggestion from Firestore. Any uploaded image will also be removed if possible."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}

      {previewImage ? (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="modal product-suggestion-image-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Suggestion image</span>
              <button type="button" className="modal-close" onClick={() => setPreviewImage(null)}>
                ×
              </button>
            </div>
            <div className="product-suggestion-image-modal-body">
              <img src={previewImage} alt="Expanded product suggestion" className="product-suggestion-image-modal-img" />
            </div>
          </div>
        </div>
      ) : null}

      <div className="page-header">
        <div>
          <h2>Product Suggestions</h2>
          <div className="breadcrumb">
            Home / <span>Product Suggestions</span>
          </div>
        </div>
        <Link to="/product-suggestions/add" className="btn btn-primary">
          <MdAdd /> Add Suggestion
        </Link>
      </div>

      <div className="filter-row product-suggestion-toolbar">
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            className={`filter-tab ${statusFilter === status ? "active" : ""}`}
            onClick={() => setStatusFilter(status)}
          >
            {status === "all" ? "All" : statusLabel(status)}
          </button>
        ))}

        <div className="search-wrap product-suggestion-search">
          <MdSearch />
          <input
            className="search-input"
            placeholder="Search text, UID, order ref…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card product-suggestion-card">
        <div className="card-header">
          <span className="card-title">
            Product Suggestions ({filtered.length})
          </span>
          <span className="text-muted" style={{ fontSize: 12 }}>
            {totalImages} with image
          </span>
        </div>

        {loading ? (
          <div className="spinner-wrap">
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <MdImage />
            <p>No product suggestions found.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="product-suggestion-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Text</th>
                  <th>User</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.imageUrl ? (
                        <button
                          type="button"
                          className="product-suggestion-image-button"
                          onClick={() => setPreviewImage(row.imageUrl)}
                          title="Click to expand"
                        >
                          <img src={row.imageUrl} alt="Suggestion" className="table-img" />
                        </button>
                      ) : (
                        <div className="no-img"><MdImage /></div>
                      )}
                    </td>
                    <td>
                      <div className="product-suggestion-text">{row.text || "—"}</div>
                      {row.adminNotes ? (
                        <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                          Notes: {row.adminNotes}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div className="product-suggestion-uid">{row.uid || "—"}</div>
                      <div className="product-suggestion-subtext">
                        Suggestion ID: {row.id}
                      </div>
                    </td>
                    <td>
                      <div className="product-suggestion-order-ref">
                        {row.orderRef || row.orderId || "—"}
                      </div>
                      {row.orderId && row.orderId !== row.orderRef ? (
                        <div className="product-suggestion-subtext">
                          Order ID: {row.orderId}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span className={`badge ${row.status === "approved" ? "badge-green" : row.status === "rejected" ? "badge-red" : "badge-blue"}`}>
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="text-muted">
                      {toMillis(row.createdAt) ? new Date(toMillis(row.createdAt)).toLocaleString() : "—"}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-warning btn-sm btn-icon"
                          title="Edit"
                          onClick={() => navigate(`/product-suggestions/edit/${row.id}`)}
                        >
                          <MdEdit />
                        </button>
                        <button
                          className="btn btn-danger btn-sm btn-icon"
                          title="Delete"
                          onClick={() => setDeleteTarget(row)}
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

      {!loading && filtered.length > 0 ? (
        <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
          {hasMore ? (
            <button
              className="btn btn-outline"
              onClick={() => load({ append: true })}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading..." : "Load more suggestions"}
            </button>
          ) : (
            <span className="text-muted" style={{ fontSize: 12 }}>
              End of suggestions list
            </span>
          )}
        </div>
      ) : null}
    </>
  );
}
