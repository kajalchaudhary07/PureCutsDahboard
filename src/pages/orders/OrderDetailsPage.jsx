import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { MdArrowBack, MdInfoOutline, MdSearch } from "react-icons/md";
import { getOrderById, getOrders } from "../../firestoreService";

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value) => {
  const dt = toDate(value);
  return dt
    ? dt.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  if (Number.isNaN(amount)) return "₹0.00";
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const getOrderRef = (order) => {
  const raw = order?.orderId || order?.code || order?.number || order?.id || "order";
  return `#${String(raw).replace(/^#/, "")}`;
};

const normalizeStatus = (status, fallback = "placed") =>
  String(status || fallback)
    .trim()
    .toLowerCase();

const getCustomer = (order = {}) => {
  const fallbackId = order.userId || order.uid || order.customerId || "";
  const fallbackPhone = order.customerPhone || order.phone || order.customer?.phone || "";

  return {
    name:
      order.customerName ||
      order.customer?.name ||
      order.userName ||
      order.user?.name ||
      fallbackId ||
      "—",
    email:
      order.customerEmail ||
      order.customer?.email ||
      order.email ||
      order.user?.email ||
      "—",
    phone: fallbackPhone || "—",
  };
};

const getItems = (order = {}) => (Array.isArray(order.items) ? order.items : []);

const getAmount = (order = {}) =>
  Number(
    order.amount ??
      order.total ??
      order.totalAmount ??
      order.grandTotal ??
      order.payableAmount ??
      0
  );

const getAddressLines = (order = {}) => {
  const delivery = order.deliveryAddress || order.address || order.shippingAddress || order.customer?.address;
  if (!delivery) return [];

  if (typeof delivery === "string") {
    return delivery
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  const parts = [
    delivery.line1,
    delivery.line2,
    delivery.landmark,
    delivery.city,
    delivery.state,
    delivery.postalCode || delivery.zip || delivery.pincode,
    delivery.country,
  ];

  return parts.map((item) => String(item || "").trim()).filter(Boolean);
};

export default function OrderDetailsPage() {
  const { id: routeOrderId } = useParams();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [search, setSearch] = useState("");

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const data = await getOrders();
      setOrders(data);
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadOrderDetails = async (orderId) => {
    const targetId = String(orderId || "").trim();
    if (!targetId) {
      setOrder(null);
      return;
    }

    setLoadingOrder(true);
    try {
      const data = await getOrderById(targetId);
      if (!data) {
        toast.error("Order not found");
        setOrder(null);
        return;
      }
      setOrder(data);
    } catch {
      toast.error("Failed to load order details");
      setOrder(null);
    } finally {
      setLoadingOrder(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    loadOrderDetails(routeOrderId);
  }, [routeOrderId]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;

    return orders.filter((entry) => {
      const customer = getCustomer(entry);
      return (
        getOrderRef(entry).toLowerCase().includes(q) ||
        customer.name.toLowerCase().includes(q) ||
        customer.email.toLowerCase().includes(q)
      );
    });
  }, [orders, search]);

  const customer = getCustomer(order || {});
  const addressLines = getAddressLines(order || {});
  const items = getItems(order || {});
  const orderAmount = getAmount(order || {});
  const orderStatus = normalizeStatus(order?.orderStatus || order?.status, "placed");
  const paymentStatus = normalizeStatus(order?.paymentStatus, "pending");

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Order Details</h2>
          <div className="breadcrumb">Home / Product Management / <span>Order Details</span></div>
        </div>
      </div>

      <div className="order-details-layout">
        <div className="card order-details-sidebar-card">
          <div className="card-header">
            <div className="card-title">Find Order</div>
          </div>

          <div className="order-details-sidebar-body">
            <div className="search-wrap orders-search-wrap">
              <MdSearch />
              <input
                className="search-input"
                placeholder="Search by order/customer"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loadingOrders ? (
              <div className="spinner-wrap"><div className="spinner" /></div>
            ) : filteredOrders.length === 0 ? (
              <div className="empty-state" style={{ padding: "24px 10px" }}>
                <MdInfoOutline />
                <p>No matching orders.</p>
              </div>
            ) : (
              <div className="order-quick-list">
                {filteredOrders.slice(0, 25).map((entry) => {
                  const isActive = routeOrderId === entry.id;
                  return (
                    <button
                      key={entry.id}
                      className={`order-quick-item${isActive ? " active" : ""}`}
                      onClick={() => navigate(`/order-details/${entry.id}`)}
                    >
                      <strong>{getOrderRef(entry)}</strong>
                      <span>{getCustomer(entry).name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="card order-details-main-card">
          {!routeOrderId ? (
            <div className="empty-state" style={{ padding: "56px 20px" }}>
              <MdInfoOutline />
              <p>Select an order from the left to view complete details.</p>
            </div>
          ) : loadingOrder ? (
            <div className="spinner-wrap"><div className="spinner" /></div>
          ) : !order ? (
            <div className="empty-state" style={{ padding: "56px 20px" }}>
              <MdInfoOutline />
              <p>Order details are unavailable for this ID.</p>
            </div>
          ) : (
            <>
              <div className="card-header">
                <div>
                  <div className="card-title">{getOrderRef(order)}</div>
                  <div className="text-muted" style={{ marginTop: 4 }}>
                    Created: {formatDateTime(order.createdAt || order.orderDate || order.date)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link to="/orders" className="btn btn-outline btn-sm">
                    <MdArrowBack /> Back to Orders
                  </Link>
                </div>
              </div>

              <div className="order-details-grid">
                <div className="order-detail-box">
                  <h4>Customer</h4>
                  <p><strong>{customer.name}</strong></p>
                  <p>{customer.email}</p>
                  <p>{customer.phone}</p>
                </div>

                <div className="order-detail-box">
                  <h4>Status</h4>
                  <p>
                    Order: <span className="badge badge-blue">{orderStatus.toUpperCase()}</span>
                  </p>
                  <p>
                    Payment: <span className={`badge ${paymentStatus === "paid" ? "badge-green" : "badge-gray"}`}>
                      {paymentStatus.toUpperCase()}
                    </span>
                  </p>
                  <p>Total: <strong>{formatCurrency(orderAmount)}</strong></p>
                </div>

                <div className="order-detail-box full">
                  <h4>Delivery Address</h4>
                  {addressLines.length === 0 ? (
                    <p className="text-muted">No delivery address provided.</p>
                  ) : (
                    <div>
                      {addressLines.map((line, idx) => (
                        <p key={`${line}-${idx}`}>{line}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ser</th>
                      <th>Item</th>
                      <th>Product ID</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-muted" style={{ textAlign: "center" }}>
                          No item information found.
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => {
                        const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
                        const unitPrice = Number(item.price ?? item.unitPrice ?? 0) || 0;
                        const lineTotal = qty * unitPrice;

                        return (
                          <tr key={item.orderItemId || `${item.productId || item.id || "item"}-${idx}`}>
                            <td className="text-muted">{idx + 1}</td>
                            <td>{item.name || item.title || `Item ${idx + 1}`}</td>
                            <td className="text-muted">{item.productId || item.id || "—"}</td>
                            <td>{qty}</td>
                            <td>{formatCurrency(unitPrice)}</td>
                            <td className="font-medium">{formatCurrency(lineTotal)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
