import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  MdDelete,
  MdReceiptLong,
  MdSearch,
} from "react-icons/md";
import ConfirmDialog from "../../components/ConfirmDialog";
import { deleteOrder, getOrders, updateOrder } from "../../firestoreService";

const ORDER_STATUS_OPTIONS = [
  "placed",
  "confirmed",
  "processing",
  "packed",
  "dispatched",
  "delivered",
  "cancelled",
];

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
  const fallbackId = order.userId || order.uid || order.customerId || "";
  const fallbackContact =
    order.contactDetails?.phone || order.customerPhone || order.phone || "";
  const receiverName =
    order.contactDetails?.receiverName || order.receiverName || "";
  return {
    name:
      receiverName ||
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
    phone: fallbackContact || "—",
  };
};

const getAddressLines = (order = {}) => {
  const delivery =
    order.deliveryAddress ||
    order.address ||
    order.shippingAddress ||
    order.customer?.address;

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

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatInvoiceAmount = (value) => {
  const amount = Number(value || 0);
  if (Number.isNaN(amount)) return "₹0.00";
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const invoiceHtml = (order) => {
  const customer = getCustomer(order);
  const addressLines = getAddressLines(order);
  const lines = Array.isArray(order.items) ? order.items : [];
  const orderRef = getOrderRef(order);
  const amount = getAmount(order);
  const orderDate = formatDate(getOrderDate(order));

  const normalizedLines = lines.map((line, idx) => {
    const qty = Number(line.qty ?? line.quantity ?? 1) || 1;
    const price = Number(line.price ?? line.unitPrice ?? 0) || 0;
    const lineTotal = qty * price;
    return {
      index: idx + 1,
      title: line.name || line.title || `Item ${idx + 1}`,
      sku: line.productId || line.id || line.orderItemId || "",
      qty,
      price,
      total: lineTotal,
    };
  });

  const subtotal =
    normalizedLines.length > 0
      ? normalizedLines.reduce((sum, item) => sum + item.total, 0)
      : amount;

  const grandTotal = amount > 0 ? amount : subtotal;
  const otherCharges = Math.max(0, grandTotal - subtotal);

  const rows =
    normalizedLines.length > 0
      ? normalizedLines
          .map((line) => {
            return `<tr>
<td class="text-center">${line.index}</td>
<td>
  <div class="item-title">${escapeHtml(line.title)}</div>
  ${line.sku ? `<div class="item-sku">SKU: ${escapeHtml(line.sku)}</div>` : ""}
</td>
<td class="text-center">${line.qty}</td>
<td class="text-right">${formatInvoiceAmount(line.price)}</td>
<td class="text-right">${formatInvoiceAmount(line.total)}</td>
</tr>`;
          })
          .join("")
      : `<tr>
<td class="text-center">1</td>
<td><div class="item-title">Order Total</div></td>
<td class="text-center">1</td>
<td class="text-right">${formatInvoiceAmount(grandTotal)}</td>
<td class="text-right">${formatInvoiceAmount(grandTotal)}</td>
</tr>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Invoice ${orderRef}</title>
<style>
*{box-sizing:border-box}
body{
  font-family: Inter, Segoe UI, Arial, sans-serif;
  background:#f4f7fb;
  color:#0f172a;
  margin:0;
  padding:32px;
}
.invoice-shell{
  max-width:980px;
  margin:0 auto;
  background:#ffffff;
  border-radius:16px;
  border:1px solid #e2e8f0;
  box-shadow:0 12px 32px rgba(15,23,42,.08);
  overflow:hidden;
}
.invoice-header{
  padding:28px 32px;
  background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);
  color:#ffffff;
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:16px;
}
.brand{font-size:24px;font-weight:800;letter-spacing:.2px}
.brand-sub{margin-top:4px;font-size:12px;opacity:.85;letter-spacing:.3px}
.invoice-meta{text-align:right}
.invoice-meta .label{font-size:11px;opacity:.85;text-transform:uppercase;letter-spacing:.5px}
.invoice-meta .value{font-size:20px;font-weight:800;margin-top:4px}
.invoice-body{padding:28px 32px 32px}
.grid{display:grid;grid-template-columns:1.2fr 1fr;gap:16px;margin-bottom:22px}
.card{border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;background:#f8fafc}
.card h4{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.4px;color:#475569}
.line{margin:4px 0;font-size:14px;color:#0f172a}
.line.subtle{color:#64748b}
table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #dbe4ef;border-radius:12px;overflow:hidden}
thead th{background:#eef4fb;color:#0f172a;font-size:12px;text-transform:uppercase;letter-spacing:.35px;padding:12px;border-bottom:1px solid #dbe4ef}
tbody td{padding:12px;border-bottom:1px solid #edf2f7;vertical-align:top}
tbody tr:last-child td{border-bottom:none}
.item-title{font-size:14px;font-weight:600;color:#0f172a}
.item-sku{margin-top:4px;font-size:12px;color:#64748b}
.text-center{text-align:center}
.text-right{text-align:right}
.totals{margin-top:18px;display:flex;justify-content:flex-end}
.totals-box{width:320px;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;background:#f8fafc}
.totals-row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#334155}
.totals-row.grand{margin-top:6px;padding-top:10px;border-top:1px dashed #cbd5e1;font-size:18px;font-weight:800;color:#0f172a}
.note{margin-top:20px;font-size:12px;color:#64748b;line-height:1.55}
@media print {
  body{background:#fff;padding:0}
  .invoice-shell{border:none;box-shadow:none;border-radius:0}
}
</style>
</head>
<body>
<section class="invoice-shell">
  <header class="invoice-header">
    <div>
      <div class="brand">PureCuts</div>
      <div class="brand-sub">PROFESSIONAL BEAUTY COMMERCE</div>
    </div>
    <div class="invoice-meta">
      <div class="label">Invoice</div>
      <div class="value">${escapeHtml(orderRef)}</div>
      <div class="label" style="margin-top:10px">Date: ${escapeHtml(orderDate)}</div>
    </div>
  </header>

  <div class="invoice-body">
    <div class="grid">
      <div class="card">
        <h4>Billed To</h4>
        <div class="line"><strong>${escapeHtml(customer.name)}</strong></div>
        <div class="line subtle">${escapeHtml(customer.email)}</div>
        <div class="line subtle">${escapeHtml(customer.phone || "—")}</div>
      </div>
      <div class="card">
        <h4>Order Summary</h4>
        <div class="line">Order ID: <strong>${escapeHtml(orderRef)}</strong></div>
        <div class="line">Items: <strong>${Math.max(1, getItemsCount(order))}</strong></div>
        <div class="line">Status: <strong>${escapeHtml(normalizeStatus(order.orderStatus || order.status, "placed").toUpperCase())}</strong></div>
      </div>
    </div>

    ${addressLines.length > 0 ? `<div class="card" style="margin-bottom:16px">
      <h4>Delivery Address</h4>
      ${addressLines.map((line) => `<div class="line">${escapeHtml(line)}</div>`).join("")}
    </div>` : ""}

    <table>
      <thead>
        <tr>
          <th style="width:70px">#</th>
          <th>Item</th>
          <th style="width:80px" class="text-center">Qty</th>
          <th style="width:160px" class="text-right">Unit Price</th>
          <th style="width:170px" class="text-right">Line Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        <div class="totals-row"><span>Subtotal</span><strong>${formatInvoiceAmount(subtotal)}</strong></div>
        ${otherCharges > 0 ? `<div class="totals-row"><span>Additional Charges</span><strong>${formatInvoiceAmount(otherCharges)}</strong></div>` : ""}
        <div class="totals-row grand"><span>Grand Total</span><span>${formatInvoiceAmount(grandTotal)}</span></div>
      </div>
    </div>

    <div class="note">
      Thank you for your purchase. This invoice is computer generated and does not require a physical signature.
    </div>
  </div>
</section>
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
    const previous = order.orderStatus || order.status || "placed";

    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, orderStatus: nextStatus, status: nextStatus } : o))
    );
    setStatusSavingId(order.id);

    try {
      await updateOrder(order.id, { orderStatus: nextStatus, status: nextStatus });
      toast.success("Order status updated");
    } catch {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, orderStatus: previous, status: previous } : o))
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
                  const orderStatus = normalizeStatus(order.orderStatus || order.status, "placed");
                  const paymentStatus = normalizeStatus(order.paymentStatus, "unpaid");

                  return (
                    <tr key={order.id}>
                      <td><input type="checkbox" aria-label={`select ${idx + 1}`} /></td>
                      <td className="text-muted">{idx + 1}</td>
                      <td>
                        <Link to={`/order-details/${order.id}`} className="order-link">
                          [{getOrderRef(order)}]
                        </Link>
                      </td>
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
                          value={ORDER_STATUS_OPTIONS.includes(orderStatus) ? orderStatus : "placed"}
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
