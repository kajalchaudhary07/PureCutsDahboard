import { useEffect, useMemo, useState } from "react";
import { MdSearch } from "react-icons/md";
import { getUsers } from "../../firestoreService";

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getUsers();
        setUsers(data);
        setSalesStatusByUser(() =>
          Object.fromEntries(
            data.map((user) => {
              const current = String(user.salesStatus || "active").toLowerCase();
              const status = SALES_STATUS.includes(current) ? current : "active";
              return [user.id || user.uid, status];
            })
          )
        );
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    load();
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

  const setStatus = (userKey, status) => {
    setSalesStatusByUser((prev) => ({ ...prev, [userKey]: status }));
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
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
