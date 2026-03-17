import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  MdDelete,
  MdReceiptLong,
  MdSearch,
} from "react-icons/md";
import ConfirmDialog from "../../components/ConfirmDialog";
import { deleteOrder, getOrders, updateOrder } from "../../firestoreService";

const ORDER_STATUS_OPTIONS = ["process", "conformerd", "packed", "dispatched"];

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const dt = toDate(value);
  return dt ? dt.toLocaleDateString() : "-";
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  if (Number.isNaN(amount)) return "0.0";
  return amount.toFixed(1);
};

const normalizeStatus = (status, fallback = "pending") =>
  String(status || fallback).trim().toLowerCase();

const getOrderRef = (order) => {
  const raw = order.orderId || order.code || order.number || order.id || "order";
  return `#${String(raw).replace(/^#/, "")}`;
};

const getCustomer = (order) => {
  return {
    name:
      order.customerName ||
      order.customer?.name ||
      order.userName ||
      order.user?.name ||
      "Unknown Customer",
    email:
      order.customerEmail ||
      order.customer?.email ||
      order.email ||
      order.user?.email ||
      "-",
  };
};

const getItemsCount = (order) => {
  if (Array.isArray(order.items)) return order.items.length;
  if (typeof order.itemsCount === "number") return order.itemsCount;
  if (typeof order.itemCount === "number") return order.itemCount;
  if (typeof order.totalItems === "number") return order.totalItems;
  return 0;
};

const getAmount = (order) =>
  Number(
    order.amount ??
      order.total ??
      order.totalAmount ??
      order.grandTotal ??
      order.payableAmount ??
      0
  );

const getOrderDate = (order) =>
  order.createdAt || order.orderDate || order.date || order.placedAt || null;

const invoiceHtml = (order) => {
  const customer = getCustomer(order);
  const lines = Array.isArray(order.items) ? order.items : [];
  const orderRef = getOrderRef(order);
  const amount = getAmount(order);

  const rows =
    lines.length > 0
      ? lines
          .map((line, idx) => {
            const qty = Number(line.qty ?? line.quantity ?? 1);
            const price = Number(line.price ?? line.unitPrice ?? 0);
            const total = qty * price;
            return `<tr>
<td>${idx + 1}</td>
<td>${line.name || line.title || "Item"}</td>
<td>${qty}</td>
<td>${price.toFixed(2)}</td>
<td>${total.toFixed(2)}</td>
</tr>`;
          })
          .join("")
      : `<tr><td>1</td><td>Order Total</td><td>1</td><td>${amount.toFixed(2)}</td><td>${amount.toFixed(2)}</td></tr>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Invoice ${orderRef}</title>
<style>
body{font-family:Arial,sans-serif;padding:24px;color:#0f172a}
h1{margin:0 0 8px}
.meta{margin:0 0 20px;color:#475569}
table{width:100%;border-collapse:collapse;margin-top:16px}
th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}
th{background:#f1f5f9}
.total{margin-top:16px;font-size:18px;font-weight:700}
</style>
</head>
<body>
<h1>Invoice ${orderRef}</h1>
<p class="meta">Date: ${formatDate(getOrderDate(order))}</p>
<p><strong>Customer:</strong> ${customer.name}<br/><strong>Email:</strong> ${customer.email}</p>
<table>
<thead>
<tr><th>#</th><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
</thead>
<tbody>${rows}</tbody>
</table>
<p class="total">Grand Total: ${amount.toFixed(2)}</p>
</body>
</html>`;
};

export default function OrdersList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusSavingId, setStatusSavingId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await getOrders();
      setOrders(data);
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;

    return orders.filter((order) => {
      const customer = getCustomer(order);
      return (
        getOrderRef(order).toLowerCase().includes(q) ||
        customer.name.toLowerCase().includes(q) ||
        customer.email.toLowerCase().includes(q)
      );
    });
  }, [orders, search]);

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteOrder(deleteTarget.id);
      toast.success("Order deleted");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Failed to delete order");
    }
  };

  const onChangeOrderStatus = async (order, nextStatus) => {
    const previous = order.orderStatus || order.status || "process";

    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, orderStatus: nextStatus } : o))
    );
    setStatusSavingId(order.id);

    try {
      await updateOrder(order.id, { orderStatus: nextStatus });
      toast.success("Order status updated");
    } catch {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, orderStatus: previous } : o))
      );
      toast.error("Failed to update order status");
    } finally {
      setStatusSavingId("");
    }
  };

  const onDownloadInvoice = (order) => {
    try {
      const html = invoiceHtml(order);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${getOrderRef(order).replace(/[^a-z0-9_-]/gi, "")}_invoice.html`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download invoice");
    }
  };

  return (
    <>
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Order?"
          message="This order will be permanently removed."
          onConfirm={onDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="page-header">
        <div>
          <h2>All Orders</h2>
          <div className="breadcrumb">Home / <span>All Orders</span></div>
        </div>
      </div>

      <div className="search-wrap orders-search-wrap">
        <MdSearch />
        <input
          className="search-input"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card">
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <MdReceiptLong />
            <p>No orders found.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" aria-label="select all" /></th>
                  <th>Ser</th>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Order Status</th>
                  <th>Payment Status</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order, idx) => {
                  const customer = getCustomer(order);
                  const orderStatus = normalizeStatus(order.orderStatus || order.status, "process");
                  const paymentStatus = normalizeStatus(order.paymentStatus, "unpaid");

                  return (
                    <tr key={order.id}>
                      <td><input type="checkbox" aria-label={`select ${idx + 1}`} /></td>
                      <td className="text-muted">{idx + 1}</td>
                      <td><span className="order-link">[{getOrderRef(order)}]</span></td>
                      <td>
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-muted" style={{ fontSize: 12 }}>{customer.email}</div>
                      </td>
                      <td>
                        <span className="order-items-pill">{Math.max(1, getItemsCount(order))}</span>
                      </td>
                      <td>
                        <select
                          className="order-status-select"
                          value={ORDER_STATUS_OPTIONS.includes(orderStatus) ? orderStatus : "process"}
                          disabled={statusSavingId === order.id}
                          onChange={(e) => onChangeOrderStatus(order, e.target.value)}
                        >
                          {ORDER_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`badge ${paymentStatus === "paid" ? "badge-green" : "badge-gray"}`}>
                          {paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}
                        </span>
                      </td>
                      <td className="font-medium">{formatCurrency(getAmount(order))}</td>
                      <td className="text-muted">{formatDate(getOrderDate(order))}</td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-outline btn-sm btn-icon"
                            title="Download invoice"
                            onClick={() => onDownloadInvoice(order)}
                          >
                            <MdReceiptLong />
                          </button>
                          <button
                            className="btn btn-danger btn-sm btn-icon"
                            title="Delete order"
                            onClick={() => setDeleteTarget(order)}
                          >
                            <MdDelete />
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
      </div>
    </>
  );
}
