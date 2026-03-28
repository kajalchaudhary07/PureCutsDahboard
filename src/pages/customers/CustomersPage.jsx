import { useEffect, useMemo, useState } from "react";
import { MdDeleteOutline, MdSearch } from "react-icons/md";
import { toast } from "react-toastify";
import {
  deleteUser,
  getUsersWithOrderCountsPaginated,
  updateUser,
} from "../../firestoreService";

const SALES_STATUS = ["active", "closeone", "inactive"];

const getInitials = (nameOrEmail) => {
  const parts = String(nameOrEmail || "U")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "U";
};

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatJoinedAt = (value) => {
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

export default function CustomersPage() {
  const [users, setUsers] = useState([]);
  const [salesStatusByUser, setSalesStatusByUser] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState("");
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const syncSalesStatusMap = (rows) => {
    setSalesStatusByUser((prev) => {
      const next = { ...prev };
      rows.forEach((user) => {
        const key = user.id || user.uid;
        if (!key || next[key]) return;
        const current = String(user.salesStatus || "active").toLowerCase();
        next[key] = SALES_STATUS.includes(current) ? current : "active";
      });
      return next;
    });
  };

  const loadCustomers = async ({ append = false } = {}) => {
    if (append) {
      if (!hasMore || loadingMore) return;
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const page = await getUsersWithOrderCountsPaginated({
        pageSize: 25,
        cursor: append ? nextCursor : null,
      });

      setUsers((prev) => (append ? [...prev, ...page.rows] : page.rows));
      syncSalesStatusMap(page.rows);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (e) {
      console.error("Failed to load customers:", e);
      toast.error("Failed to load customers");
      if (!append) setUsers([]);
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadCustomers({ append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      return (
        String(user.name || "").toLowerCase().includes(q) ||
        String(user.email || "").toLowerCase().includes(q) ||
        String(user.phone || user.mobile || "").toLowerCase().includes(q)
      );
    });
  }, [search, users]);

  const setStatus = async (userKey, status) => {
    setSalesStatusByUser((prev) => ({ ...prev, [userKey]: status }));
    try {
      await updateUser(userKey, { salesStatus: status });
      toast.success(`Sales status updated to ${status}`);
    } catch (e) {
      console.error("Failed to update sales status:", e);
      toast.error("Failed to update sales status");
      // Revert on error
      setSalesStatusByUser((prev) => {
        const user = users.find((u) => (u.id || u.uid) === userKey);
        return { ...prev, [userKey]: user?.salesStatus || "active" };
      });
    }
  };

  const onDeleteCustomer = async (user) => {
    const userKey = user?.id || user?.uid;
    if (!userKey || deletingCustomerId) return;

    const customerName = String(user?.name || user?.email || "this customer");
    const confirmed = window.confirm(
      `Delete ${customerName}? This will remove the customer profile from dashboard users.`
    );
    if (!confirmed) return;

    setDeletingCustomerId(userKey);

    const prevUsers = users;
    const prevStatusMap = salesStatusByUser;

    setUsers((prev) => prev.filter((u) => (u.id || u.uid) !== userKey));
    setSalesStatusByUser((prev) => {
      const next = { ...prev };
      delete next[userKey];
      return next;
    });

    try {
      await deleteUser(userKey);
      toast.success("Customer deleted");
    } catch (e) {
      console.error("Failed to delete customer:", e);
      toast.error("Failed to delete customer");
      setUsers(prevUsers);
      setSalesStatusByUser(prevStatusMap);
    } finally {
      setDeletingCustomerId("");
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Customers</h2>
          <div className="breadcrumb">Home / <span>Customers</span></div>
        </div>
      </div>

      <div className="search-wrap customers-search-wrap">
        <MdSearch />
        <input
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone"
        />
      </div>

      <section className="card">
        <div className="card-header">
          <span className="card-title">Customer Directory ({filtered.length})</span>
        </div>
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>No customers found.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="customers-table">
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" aria-label="Select all customers" />
                  </th>
                  <th>Ser</th>
                  <th>Customer</th>
                  <th>E-Mail</th>
                  <th>Phone Number</th>
                  <th>Orders</th>
                  <th>Joining Date</th>
                  <th>Sales Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user, index) => {
                  const userKey = user.id || user.uid;
                  const salesStatus = salesStatusByUser[userKey] || "active";
                  return (
                  <tr key={userKey}>
                    <td>
                      <input type="checkbox" aria-label={`Select ${user.name || user.email || "customer"}`} />
                    </td>
                    <td className="text-muted">{index + 1}</td>
                    <td>
                      <div className="customer-cell">
                        <div className="customer-avatar">{getInitials(user.name || user.email)}</div>
                        <div>
                          <div className="font-medium">{user.name || "Unnamed user"}</div>
                          <div className="text-muted">{user.uid || user.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>{user.email || "-"}</td>
                    <td>{user.phone || user.mobile || "-"}</td>
                    <td>
                      <span className="customer-count-pill">{user.ordersCount || 0}</span>
                    </td>
                    <td>{formatJoinedAt(user.createdAt)}</td>
                    <td>
                      <select
                        className={`customer-status-select ${salesStatus}`}
                        value={salesStatus}
                        onChange={(e) => setStatus(userKey, e.target.value)}
                      >
                        {SALES_STATUS.map((status) => (
                          <option key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm btn-icon"
                        onClick={() => onDeleteCustomer(user)}
                        disabled={deletingCustomerId === userKey}
                        title="Delete customer"
                        aria-label={`Delete ${user.name || user.email || "customer"}`}
                      >
                        {deletingCustomerId === userKey ? "..." : <MdDeleteOutline />}
                      </button>
                    </td>
                  </tr>
                );})}
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
              onClick={() => loadCustomers({ append: true })}
            >
              {loadingMore ? "Loading..." : "Load more customers"}
            </button>
          ) : (
            <span className="text-muted" style={{ fontSize: 12 }}>
              You’ve reached the end of loaded customers.
            </span>
          )}
        </div>
      )}
    </>
  );
}
