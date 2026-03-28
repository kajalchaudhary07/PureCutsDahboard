import { useEffect, useMemo, useState } from "react";
import {
  MdInventory2,
  MdPeople,
  MdRateReview,
  MdShoppingCart,
  MdTrendingUp,
} from "react-icons/md";
import { getDashboardMetrics } from "../../firestoreService";

const money = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount)
    ? amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })
    : "0";
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export default function DashboardPage() {
  const [orders, setOrders] = useState([]);
  const [snapshot, setSnapshot] = useState({
    ordersCount: 0,
    productsCount: 0,
    customersCount: 0,
    approvedReviews: 0,
    totalRevenue: 0,
    pendingOrders: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getDashboardMetrics({ recentOrdersPageSize: 120 });
        setOrders(data.recentOrders || []);
        setSnapshot({
          ordersCount: data.ordersCount || 0,
          productsCount: data.productsCount || 0,
          customersCount: data.customersCount || 0,
          approvedReviews: data.approvedReviews || 0,
          totalRevenue: data.totalRevenue || 0,
          pendingOrders: data.pendingOrders || 0,
        });
      } catch {
        setOrders([]);
        setSnapshot({
          ordersCount: 0,
          productsCount: 0,
          customersCount: 0,
          approvedReviews: 0,
          totalRevenue: 0,
          pendingOrders: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const stats = useMemo(() => {
    return {
      revenue: snapshot.totalRevenue,
      ordersCount: snapshot.ordersCount,
      productsCount: snapshot.productsCount,
      customersCount: snapshot.customersCount,
      approvedReviews: snapshot.approvedReviews,
      pendingOrders: snapshot.pendingOrders,
    };
  }, [snapshot]);

  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      .slice(0, 6);
  }, [orders]);

  const trend = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0, 0, 0];
    const now = new Date();
    orders.forEach((order) => {
      const time = toMillis(order.createdAt);
      if (!time) return;
      const diff = Math.floor((now.getTime() - time) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff < 7) {
        buckets[6 - diff] += 1;
      }
    });

    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const max = Math.max(1, ...buckets);
    return labels.map((label, idx) => ({
      label,
      count: buckets[idx],
      height: Math.round((buckets[idx] / max) * 100),
    }));
  }, [orders]);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <div className="breadcrumb">Home / <span>Dashboard</span></div>
        </div>
      </div>

      <div className="dashboard-kpi-grid">
        <article className="card dashboard-kpi-card">
          <div className="dashboard-kpi-icon blue"><MdTrendingUp /></div>
          <div>
            <p>Total Revenue</p>
            <h3>{loading ? "..." : `₹${money(stats.revenue)}`}</h3>
          </div>
        </article>

        <article className="card dashboard-kpi-card">
          <div className="dashboard-kpi-icon indigo"><MdShoppingCart /></div>
          <div>
            <p>Orders</p>
            <h3>{loading ? "..." : stats.ordersCount}</h3>
          </div>
        </article>

        <article className="card dashboard-kpi-card">
          <div className="dashboard-kpi-icon teal"><MdInventory2 /></div>
          <div>
            <p>Products</p>
            <h3>{loading ? "..." : stats.productsCount}</h3>
          </div>
        </article>

        <article className="card dashboard-kpi-card">
          <div className="dashboard-kpi-icon green"><MdPeople /></div>
          <div>
            <p>Customers</p>
            <h3>{loading ? "..." : stats.customersCount}</h3>
          </div>
        </article>
      </div>

      <div className="dashboard-main-grid">
        <section className="card">
          <div className="card-header">
            <span className="card-title">Order Trend (7 Days)</span>
          </div>
          <div className="dashboard-trend-wrap">
            {trend.map((point) => (
              <div key={point.label} className="dashboard-trend-col">
                <div className="dashboard-trend-bar-wrap">
                  <div className="dashboard-trend-bar" style={{ height: `${Math.max(8, point.height)}%` }} />
                </div>
                <span>{point.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card dashboard-quick-card">
          <div className="card-header">
            <span className="card-title">Quick Stats</span>
          </div>
          <div className="dashboard-quick-list">
            <div><span>Pending Orders</span><strong>{stats.pendingOrders}</strong></div>
            <div><span>Approved Reviews</span><strong>{stats.approvedReviews}</strong></div>
            <div><span>Notifications Ready</span><strong>{orders.length > 0 ? "Yes" : "No"}</strong></div>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <span className="card-title">Recent Orders</span>
        </div>
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : recentOrders.length === 0 ? (
          <div className="empty-state">
            <p>No orders found.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-medium">#{order.orderId || order.code || order.id}</td>
                    <td>{order.customerName || order.customer?.name || "Unknown"}</td>
                    <td>
                      <span className="badge badge-gray">
                        {order.orderStatus || order.status || "new"}
                      </span>
                    </td>
                    <td>₹{money(order.totalAmount ?? order.total ?? order.grandTotal ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
