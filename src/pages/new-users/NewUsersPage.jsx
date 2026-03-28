import { useEffect, useMemo, useState } from "react";
import { MdCheckCircle, MdClose, MdSearch } from "react-icons/md";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthProvider";
import {
  getVerificationRequestsPaginated,
  setVerificationRequestStatus,
} from "../../firestoreService";

const STATUS_TABS = ["all", "pending", "approved", "rejected"];

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value) => {
  const dt = toDate(value);
  if (!dt) return "-";
  return dt.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const cleanText = (value) => String(value || "").trim();

const getRequestStatus = (request) => {
  const status = cleanText(request.status).toLowerCase();
  if (status) return status;
  if (request.approved === true) return "approved";
  if (request.rejected === true) return "rejected";
  return "pending";
};

const resolveUserId = (request = {}) => {
  const candidates = [
    request.userId,
    request.uid,
    request.customerId,
    request.user && (request.user.id || request.user.uid),
  ];
  for (const candidate of candidates) {
    const value = cleanText(candidate);
    if (value) return value;
  }
  return "-";
};

const getName = (request = {}) =>
  cleanText(
    request.name ||
      request.userName ||
      request.fullName ||
      request.businessName ||
      request.ownerName ||
      request.user?.name
  ) || "-";

const getEmail = (request = {}) =>
  cleanText(request.email || request.userEmail || request.user?.email) || "-";

const getGst = (request = {}) =>
  cleanText(
    request.gstNumber || request.gst || request.gstin || request.gstNo
  ) || "Not Provided";

const getUdyam = (request = {}) =>
  cleanText(
    request.udyamNumber || request.udyam || request.udyamNo || request.msmeNumber
  ) || "Not Provided";

export default function NewUsersPage() {
  const { user } = useAuth();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("pending");
  const [savingById, setSavingById] = useState({});

  const load = async ({ append = false } = {}) => {
    if (append) {
      if (!hasMore || loadingMore) return;
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const page = await getVerificationRequestsPaginated({
        pageSize: 25,
        cursor: append ? nextCursor : null,
      });

      setRows((prev) => (append ? [...prev, ...page.rows] : page.rows));
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (error) {
      console.error("Failed to load verification requests", error);
      toast.error("Failed to load new user requests");
      if (!append) setRows([]);
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    load({ append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const query = cleanText(search).toLowerCase();

    return rows.filter((request) => {
      const status = getRequestStatus(request);
      if (statusTab !== "all" && status !== statusTab) return false;

      if (!query) return true;

      const haystack = [
        getName(request),
        getEmail(request),
        resolveUserId(request),
        getGst(request),
        getUdyam(request),
        request.id,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [rows, search, statusTab]);

  const setStatus = async (request, status) => {
    const requestId = cleanText(request.id);
    if (!requestId) return;

    setSavingById((prev) => ({ ...prev, [requestId]: status }));

    try {
      await setVerificationRequestStatus(requestId, {
        status,
        reviewedBy: cleanText(user?.email) || "admin",
      });

      setRows((prev) =>
        prev.map((row) =>
          row.id === requestId
            ? {
                ...row,
                status,
                approved: status === "approved",
                rejected: status === "rejected",
                reviewedBy: cleanText(user?.email) || "admin",
                reviewedAt: new Date(),
              }
            : row
        )
      );

      toast.success(
        status === "approved"
          ? "User approved successfully"
          : "User rejected successfully"
      );
    } catch (error) {
      console.error("Failed to update verification request", error);
      toast.error("Failed to update request status");
    } finally {
      setSavingById((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>New Users</h2>
          <div className="breadcrumb">
            Home / Product Management / <span>New Users</span>
          </div>
        </div>
      </div>

      <div className="search-wrap customers-search-wrap" style={{ marginBottom: 10 }}>
        <MdSearch />
        <input
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, GST, Udyam, user ID"
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {STATUS_TABS.map((tab) => {
          const active = statusTab === tab;
          return (
            <button
              key={tab}
              type="button"
              className={`btn ${active ? "btn-primary" : "btn-outline"}`}
              onClick={() => setStatusTab(tab)}
              style={{ textTransform: "capitalize" }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      <section className="card">
        <div className="card-header">
          <span className="card-title">Verification Requests ({filtered.length})</span>
        </div>

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>No verification requests found.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="customers-table">
              <thead>
                <tr>
                  <th>Ser</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>User ID</th>
                  <th>GST Number</th>
                  <th>Udyam Number</th>
                  <th>Status</th>
                  <th>Requested At</th>
                  <th>Reviewed By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((request, index) => {
                  const status = getRequestStatus(request);
                  const requestId = cleanText(request.id);
                  const isSaving = Boolean(savingById[requestId]);
                  const isPending = status === "pending";

                  return (
                    <tr key={requestId || `${resolveUserId(request)}-${index}`}>
                      <td className="text-muted">{index + 1}</td>
                      <td>{getName(request)}</td>
                      <td>{getEmail(request)}</td>
                      <td>{resolveUserId(request)}</td>
                      <td>{getGst(request)}</td>
                      <td>{getUdyam(request)}</td>
                      <td>
                        <span
                          className={`badge ${
                            status === "approved"
                              ? "badge-green"
                              : status === "rejected"
                              ? "badge-gray"
                              : "badge-blue"
                          }`}
                          style={{ textTransform: "uppercase" }}
                        >
                          {status}
                        </span>
                      </td>
                      <td>{formatDateTime(request.createdAt || request.requestedAt)}</td>
                      <td>{cleanText(request.reviewedBy) || "-"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={!isPending || isSaving}
                            title="Approve"
                            onClick={() => setStatus(request, "approved")}
                          >
                            {isSaving ? "..." : <MdCheckCircle />}
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            disabled={!isPending || isSaving}
                            title="Reject"
                            onClick={() => setStatus(request, "rejected")}
                          >
                            {isSaving ? "..." : <MdClose />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!loading && filtered.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
          {hasMore ? (
            <button
              className="btn btn-outline"
              disabled={loadingMore}
              onClick={() => load({ append: true })}
            >
              {loadingMore ? "Loading..." : "Load more requests"}
            </button>
          ) : (
            <span className="text-muted" style={{ fontSize: 12 }}>
              You’ve reached the end of loaded requests.
            </span>
          )}
        </div>
      )}
    </>
  );
}
