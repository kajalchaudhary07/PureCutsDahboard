import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  MdQrCode2,
  MdDelete,
  MdReceiptLong,
  MdSearch,
} from "react-icons/md";
import ConfirmDialog from "../../components/ConfirmDialog";
import {
  createCodOrderScanner,
  createOrderNotification,
  deleteOrder,
  getOrdersPaginated,
  updateOrder,
} from "../../firestoreService";

const ORDER_STATUS_OPTIONS = [
  "placed",
  "confirmed",
  "processing",
  "packed",
  "dispatched",
  "delivered",
  "edited",
  "cancelled",
];

const PAYMENT_STATUS_OPTIONS = [
  "paid",
  "unpaid",
  "pending",
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

const getCancellationActor = (order = {}) => {
  const status = normalizeStatus(order.orderStatus || order.status, "placed");
  if (status !== "cancelled") return "";

  const cancelledBy = String(order.cancelledBy || order.canceledBy || "")
    .trim()
    .toLowerCase();
  const source = String(order.cancellationSource || order.cancelSource || "")
    .trim()
    .toLowerCase();

  const userBy = ["user", "customer", "app_user"];
  const adminBy = ["admin", "dashboard", "staff", "superadmin"];

  if (userBy.some((token) => cancelledBy.includes(token))) return "User";
  if (adminBy.some((token) => cancelledBy.includes(token))) return "Admin";

  if (userBy.some((token) => source.includes(token))) return "User";
  if (adminBy.some((token) => source.includes(token))) return "Admin";

  return "Unknown";
};

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
    salonName:
      order.salonName ||
      order.salon_name ||
      order.salon ||
      order.customer?.salonName ||
      order.customer?.salon_name ||
      order.customer?.salon ||
      order.user?.salonName ||
      order.user?.salon_name ||
      order.user?.salon ||
      "",
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

const getOrderProductLabel = (order = {}) => {
  const items = Array.isArray(order.items) ? order.items : [];
  const names = items
    .map((item) =>
      String(
        item?.productName || item?.name || item?.title || item?.product?.name || ""
      ).trim()
    )
    .filter(Boolean);

  if (names.length === 0) return "your order";
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1} more item${names.length - 1 > 1 ? "s" : ""}`;
};

const getOrderStatusNotificationTemplate = (status, order = {}) => {
  const productLabel = getOrderProductLabel(order);

  if (status === "confirmed") {
    return {
      title: `Order Confirmed: ${productLabel}`,
      message: `Your order for ${productLabel} is confirmed and being prepared.`,
    };
  }

  if (status === "processing") {
    return {
      title: `Order Processing: ${productLabel}`,
      message: `Your order for ${productLabel} is currently being processed.`,
    };
  }

  if (status === "packed") {
    return {
      title: `Order Packed: ${productLabel}`,
      message: `Your order for ${productLabel} has been packed and will be dispatched soon.`,
    };
  }

  if (status === "dispatched") {
    return {
      title: `Order Dispatched: ${productLabel}`,
      message: `Your order for ${productLabel} has been dispatched.`,
    };
  }

  if (status === "delivered") {
    return {
      title: `Order Delivered: ${productLabel}`,
      message: `Your order for ${productLabel} has been delivered. Thank you for shopping with PureCuts.`,
    };
  }

  if (status === "cancelled") {
    return {
      title: `Order Cancelled: ${productLabel}`,
      message: `Your order for ${productLabel} has been cancelled. If this looks incorrect, please contact support.`,
    };
  }

  return {
    title: `Order Update: ${productLabel}`,
    message: `Your order for ${productLabel} has been updated to ${String(status || "updated")}.`,
  };
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

const getPaymentMode = (order) =>
  String(order.paymentMethod || order.paymentMode || "cod")
    .trim()
    .toUpperCase();

const normalizePaymentMethod = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

const isCodPaymentMethod = (value = "") => {
  const normalized = normalizePaymentMethod(value);
  return normalized === "cod" || normalized === "cashondelivery";
};

const getScannerState = (order = {}) =>
  String(order.codScanner?.state || order.scannerLockState || "none")
    .trim()
    .toLowerCase();

const isCodOrder = (order = {}) =>
  isCodPaymentMethod(order.paymentMethod || order.paymentMode || "cod");

const scannerBadgeClass = (state) => {
  if (state === "paid") return "badge-green";
  if (state === "active") return "badge-orange";
  if (state === "expired" || state === "void") return "badge-red";
  return "badge-gray";
};

const downloadFromUrl = async (url, filename) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not fetch scanner image");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
};

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
  const scanner = order.codScanner && typeof order.codScanner === "object" ? order.codScanner : null;
  const scannerState = getScannerState(order);
  const scannerLockedAmount = Number(
    scanner?.lockedAmount ?? order.scannerLockedAmount ?? grandTotal
  );
  const hasScannerLock = scannerState !== "none" && Number.isFinite(scannerLockedAmount);

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

    ${hasScannerLock ? `<div class="card" style="margin-top:16px">
      <h4>COD Scanner Lock</h4>
      <div class="line">Scanner Status: <strong>${escapeHtml(scannerState.toUpperCase())}</strong></div>
      <div class="line">Locked Amount: <strong>${formatInvoiceAmount(scannerLockedAmount)}</strong></div>
      ${scanner?.reference ? `<div class="line">Scanner Ref: <strong>${escapeHtml(scanner.reference)}</strong></div>` : ""}
    </div>` : ""}

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [deletingMultiple, setDeletingMultiple] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState("");
  const [paymentSavingId, setPaymentSavingId] = useState("");
  const [scannerSavingId, setScannerSavingId] = useState("");
  const [paymentModal, setPaymentModal] = useState({
    open: false,
    order: null,
    paidAmount: "",
    paymentReference: "",
    paymentMethod: "cash",
  });

  const load = async ({ append = false } = {}) => {
    if (append) {
      if (!hasMore || loadingMore) return;
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const page = await getOrdersPaginated({
        pageSize: 25,
        cursor: append ? nextCursor : null,
      });
      setOrders((prev) => (append ? [...prev, ...page.rows] : page.rows));
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      toast.error("Failed to load orders");
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
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;

    return orders.filter((order) => {
      const customer = getCustomer(order);
      return (
        getOrderRef(order).toLowerCase().includes(q) ||
        customer.name.toLowerCase().includes(q) ||
        customer.email.toLowerCase().includes(q) ||
        customer.phone.toLowerCase().includes(q)
      );
    });
  }, [orders, search]);

  // Clear selection when search changes
  useEffect(() => {
    setSelectedOrders([]);
  }, [search]);

  const toggleOrderSelection = (orderId) => {
    setSelectedOrders((prev) => {
      if (prev.includes(orderId)) {
        return prev.filter((id) => id !== orderId);
      } else {
        return [...prev, orderId];
      }
    });
  };

  const toggleSelectAll = () => {
    const filteredIds = filtered.map((order) => order.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedOrders.includes(id));
    
    if (allSelected) {
      // Deselect all visible orders
      setSelectedOrders((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      // Select all visible orders (add to existing selections)
      setSelectedOrders((prev) => {
        const newIds = filteredIds.filter((id) => !prev.includes(id));
        return [...prev, ...newIds];
      });
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteOrder(deleteTarget.id);
      toast.success("Order deleted");
      setDeleteTarget(null);
      load({ append: false });
    } catch {
      toast.error("Failed to delete order");
    }
  };

  const onDeleteMultiple = async () => {
    if (selectedOrders.length === 0) return;
    
    setDeletingMultiple(true);
    try {
      let deleted = 0;
      let failed = 0;

      for (const orderId of selectedOrders) {
        try {
          await deleteOrder(orderId);
          deleted++;
        } catch {
          failed++;
        }
      }

      if (deleted > 0) {
        toast.success(`${deleted} order${deleted > 1 ? "s" : ""} deleted`);
      }
      if (failed > 0) {
        toast.error(`Failed to delete ${failed} order${failed > 1 ? "s" : ""}`);
      }

      setSelectedOrders([]);
      setShowBulkDeleteDialog(false);
      load({ append: false });
    } catch {
      toast.error("Failed to delete orders");
    } finally {
      setDeletingMultiple(false);
    }
  };

  const onChangeOrderStatus = async (order, nextStatus) => {
    const previous = order.orderStatus || order.status || "placed";
    const normalizedNextStatus = normalizeStatus(nextStatus, "placed");
    const isCancelling = normalizedNextStatus === "cancelled";
    const nextPatch = isCancelling
      ? {
          orderStatus: nextStatus,
          status: nextStatus,
          cancelledBy: "admin",
          cancellationSource: "dashboard_admin",
          cancellationReason: "Cancelled by admin from dashboard",
          cancelledAt: order.cancelledAt || new Date(),
          ...(getScannerState(order) === "active"
            ? {
                codScanner: {
                  ...(order.codScanner || {}),
                  state: "void",
                  voidAt: new Date(),
                  voidReason: "Order cancelled",
                },
                scannerLockState: "void",
                scannerState: "void",
              }
            : {}),
        }
      : {
          orderStatus: nextStatus,
          status: nextStatus,
        };

    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, ...nextPatch } : o))
    );
    setStatusSavingId(order.id);

    try {
      await updateOrder(order.id, nextPatch);
      const tpl = getOrderStatusNotificationTemplate(nextStatus, {
        ...order,
        ...nextPatch,
      });

      try {
        await createOrderNotification({
          order: {
            ...order,
            id: order.id,
            orderStatus: nextStatus,
            status: nextStatus,
          },
          status: nextStatus,
          title: tpl.title,
          message: tpl.message,
          sendApp: true,
          sendSms: false,
          sendWhatsapp: false,
          createdBy: "admin",
        });
        toast.success("Order status updated and customer notified");
      } catch (notifyError) {
        const messageText =
          notifyError?.message || notifyError?.code || "Notification failed";
        toast.warning(`Order status updated, but notification failed: ${messageText}`);
      }
    } catch {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, orderStatus: previous, status: previous } : o))
      );
      toast.error("Failed to update order status");
    } finally {
      setStatusSavingId("");
    }
  };

  const onChangePaymentStatus = async (order, nextPaymentStatus) => {
    const normalizedNextStatus = normalizeStatus(nextPaymentStatus, "unpaid");

    // Open payment details modal for pending/paid statuses
    if (normalizedNextStatus === "pending" || normalizedNextStatus === "paid") {
      const orderAmount = getAmount(order);
      setPaymentModal({
        open: true,
        order,
        paidAmount: normalizedNextStatus === "paid" ? String(orderAmount) : "",
        paymentReference: "",
        paymentMethod: "cash",
        nextStatus: normalizedNextStatus,
      });
      return;
    }

    // For unpaid, update directly
    const previous = order.paymentStatus || "unpaid";
    const nextPatch = {
      paymentStatus: normalizedNextStatus,
      paymentStatusUpdatedAt: new Date(),
      paymentStatusUpdatedBy: "admin",
    };

    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, ...nextPatch } : o))
    );
    setPaymentSavingId(order.id);

    try {
      await updateOrder(order.id, nextPatch);
      toast.success(`Payment status updated to ${normalizedNextStatus.toUpperCase()}`);
    } catch {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, paymentStatus: previous } : o))
      );
      toast.error("Failed to update payment status");
    } finally {
      setPaymentSavingId("");
    }
  };

  const onSavePaymentDetails = async () => {
    const { order, paidAmount, paymentReference, paymentMethod, nextStatus } = paymentModal;

    if (!order?.id) {
      toast.error("Order not found");
      return;
    }

    const paid = Number(paidAmount || 0);
    const orderAmount = getAmount(order);

    if (paid <= 0) {
      toast.error("Please enter a valid paid amount");
      return;
    }

    if (paid > orderAmount) {
      toast.error(`Paid amount cannot exceed order total (₹${orderAmount.toFixed(2)})`);
      return;
    }

    const nextPatch = {
      paymentStatus: nextStatus,
      paidAmount: paid,
      paymentMethod: paymentMethod || "cash",
      paymentReference: String(paymentReference || "").trim(),
      paymentStatusUpdatedAt: new Date(),
      paymentStatusUpdatedBy: "admin",
      paymentHistory: [
        {
          status: nextStatus,
          amount: paid,
          method: paymentMethod || "cash",
          reference: String(paymentReference || "").trim(),
          updatedAt: new Date(),
          updatedBy: "admin",
        },
        ...(Array.isArray(order.paymentHistory) ? order.paymentHistory : []),
      ],
    };

    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, ...nextPatch } : o))
    );
    setPaymentSavingId(order.id);
    setPaymentModal({ open: false, order: null, paidAmount: "", paymentReference: "", paymentMethod: "cash" });

    try {
      await updateOrder(order.id, nextPatch);
      const status = nextStatus.toUpperCase();
      toast.success(`Payment recorded - ${status} (₹${paid.toFixed(2)})`);
    } catch {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, paymentStatus: order.paymentStatus } : o))
      );
      toast.error("Failed to save payment details");
    } finally {
      setPaymentSavingId("");
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

  const onDownloadScanner = async (order, { regenerate = false } = {}) => {
    if (!isCodOrder(order)) {
      toast.info("Scanner is only available for COD orders");
      return;
    }

    setScannerSavingId(order.id);
    try {
      const scanner = await createCodOrderScanner(order.id, {
        forceRegenerate: regenerate,
        createdBy: "admin_dashboard",
      });

      setOrders((prev) =>
        prev.map((entry) =>
          entry.id === order.id
            ? {
                ...entry,
                codScanner: scanner,
                scannerLockState: scanner.state,
                scannerLockedAmount: scanner.lockedAmount,
                scannerReference: scanner.reference,
              }
            : entry
        )
      );

      const safeName = `${getOrderRef(order).replace(/[^a-z0-9_-]/gi, "")}_scanner.png`;
      if (scanner.qrImageUrl) {
        await downloadFromUrl(scanner.qrImageUrl, safeName);
      } else {
        const fallback = document.createElement("a");
        fallback.href = `data:text/plain;charset=utf-8,${encodeURIComponent(String(scanner.payload || ""))}`;
        fallback.download = safeName.replace(/\.png$/i, "_payload.txt");
        fallback.click();
      }

      toast.success("Scanner downloaded");
    } catch (error) {
      toast.error(error?.message || "Failed to generate scanner");
    } finally {
      setScannerSavingId("");
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

      {showBulkDeleteDialog && selectedOrders.length > 0 && (
        <ConfirmDialog
          title={`Delete ${selectedOrders.length} Order${selectedOrders.length > 1 ? "s" : ""}?`}
          message={`${selectedOrders.length} order${selectedOrders.length > 1 ? "s" : ""} will be permanently removed.`}
          onConfirm={onDeleteMultiple}
          onCancel={() => setShowBulkDeleteDialog(false)}
          isLoading={deletingMultiple}
        />
      )}

      {paymentModal.open && (
        <div className="modal-overlay" onClick={() => setPaymentModal({ ...paymentModal, open: false })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Record Payment</div>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setPaymentModal({ ...paymentModal, open: false })}
              >
                Close
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <strong>Order:</strong> {getOrderRef(paymentModal.order || {})} | Total: ₹{formatCurrency(getAmount(paymentModal.order || {}))}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                  Paid Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  max={getAmount(paymentModal.order || {})}
                  step="0.01"
                  placeholder="Enter amount paid"
                  value={paymentModal.paidAmount}
                  onChange={(e) => setPaymentModal({ ...paymentModal, paidAmount: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                  Payment Method
                </label>
                <select
                  value={paymentModal.paymentMethod}
                  onChange={(e) => setPaymentModal({ ...paymentModal, paymentMethod: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                >
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                  Payment Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Check #, Transaction ID, UPI Ref, etc."
                  value={paymentModal.paymentReference}
                  onChange={(e) => setPaymentModal({ ...paymentModal, paymentReference: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  className="btn btn-outline"
                  onClick={() => setPaymentModal({ ...paymentModal, open: false })}
                  disabled={paymentSavingId === paymentModal.order?.id}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={onSavePaymentDetails}
                  disabled={paymentSavingId === paymentModal.order?.id}
                >
                  {paymentSavingId === paymentModal.order?.id ? "Saving..." : "Save Payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
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

      {selectedOrders.length > 0 && (
        <div style={{
          marginBottom: 16,
          padding: 12,
          backgroundColor: "var(--color-info-light)",
          border: "1px solid var(--color-info)",
          borderRadius: 6,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontWeight: 500 }}>
            {selectedOrders.length} order{selectedOrders.length > 1 ? "s" : ""} selected
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setSelectedOrders([])}
            >
              Clear Selection
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => setShowBulkDeleteDialog(true)}
              disabled={deletingMultiple}
            >
              {deletingMultiple ? "Deleting..." : "Delete Selected"}
            </button>
          </div>
        </div>
      )}

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
                  <th><input 
                    type="checkbox" 
                    aria-label="select all"
                    checked={filtered.length > 0 && filtered.every((order) => selectedOrders.includes(order.id))}
                    onChange={toggleSelectAll}
                  /></th>
                  <th>Ser</th>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Order Status</th>
                  <th>Payment Status</th>
                  <th>Payment Mode</th>
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
                  const cancellationActor = getCancellationActor(order);
                  const cancellationReason = String(order.cancellationReason || "").trim();
                  const scannerState = getScannerState(order);
                  const showScanner = isCodOrder(order) && paymentStatus !== "paid";
                  const scannerBusy = scannerSavingId === order.id;

                  return (
                    <tr key={order.id}>
                      <td><input 
                        type="checkbox"
                        aria-label={`select ${idx + 1}`}
                        checked={selectedOrders.includes(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                      /></td>
                      <td className="text-muted">{idx + 1}</td>
                      <td>
                        <Link to={`/order-details/${order.id}`} className="order-link">
                          [{getOrderRef(order)}]
                        </Link>
                      </td>
                      <td>
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                          {customer.salonName ? `📍 ${customer.salonName}` : "—"}
                        </div>
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
                        {orderStatus === "cancelled" ? (
                          <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                            Cancelled by {cancellationActor}
                            {cancellationReason ? ` • ${cancellationReason}` : ""}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <select
                          className="order-status-select"
                          value={PAYMENT_STATUS_OPTIONS.includes(paymentStatus) ? paymentStatus : "unpaid"}
                          disabled={paymentSavingId === order.id}
                          onChange={(e) => onChangePaymentStatus(order, e.target.value)}
                          style={{ width: "100%" }}
                        >
                          {PAYMENT_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </option>
                          ))}
                        </select>
                        {paymentStatus === "paid" && order.paidAmount ? (
                          <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                            Paid: ₹{Number(order.paidAmount).toFixed(2)} | {String(order.paymentMethod || "cash").toUpperCase()}
                          </div>
                        ) : null}
                        {paymentStatus === "pending" ? (
                          <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                            Pending: ₹{(Number(order.paidAmount || 0) > 0 
                              ? (getAmount(order) - Number(order.paidAmount || 0)).toFixed(2)
                              : getAmount(order).toFixed(2))}
                            {order.paymentReference ? ` | Ref: ${order.paymentReference}` : ""}
                          </div>
                        ) : null}
                        {isCodOrder(order) ? (
                          <span
                            className={`badge ${scannerBadgeClass(scannerState)}`}
                            style={{ marginLeft: 0, marginTop: 6, display: "block" }}
                          >
                            {scannerState === "none" ? "No Scanner" : `Scanner ${scannerState}`}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <span className="badge badge-blue">{getPaymentMode(order)}</span>
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
                          {showScanner ? (
                            <button
                              className="btn btn-outline btn-sm btn-icon"
                              title={scannerState === "active" ? "Regenerate scanner" : "Download scanner"}
                              disabled={scannerBusy}
                              onClick={() =>
                                onDownloadScanner(order, {
                                  regenerate: scannerState === "active",
                                })
                              }
                            >
                              <MdQrCode2 />
                            </button>
                          ) : null}
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

        {!loading && filtered.length > 0 && (
          <div style={{ padding: "0 16px 16px", display: "flex", justifyContent: "center" }}>
            {hasMore ? (
              <button
                className="btn btn-outline"
                disabled={loadingMore}
                onClick={() => load({ append: true })}
              >
                {loadingMore ? "Loading..." : "Load more orders"}
              </button>
            ) : (
              <span className="text-muted" style={{ fontSize: 12 }}>
                You’ve reached the end of loaded orders.
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
}
