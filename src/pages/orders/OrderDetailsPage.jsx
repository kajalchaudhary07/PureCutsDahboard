 import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { MdArrowBack, MdDone, MdInfoOutline, MdQrCode2, MdReceiptLong, MdSearch } from "react-icons/md";
import {
  createCodOrderScanner,
  getOrderById,
  getOrders,
  markCodOrderScannerPaid,
  updateOrder,
} from "../../firestoreService";

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
  const fallbackPhone =
    order.contactDetails?.phone ||
    order.customerPhone ||
    order.phone ||
    order.customer?.phone ||
    "";
  const fallbackReceiverName =
    order.contactDetails?.receiverName ||
    order.receiverName ||
    "";

  return {
    name:
      fallbackReceiverName ||
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
    delivery.receiverName,
    delivery.phone,
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

const getContactDetails = (order = {}) => {
  const receiverName =
    order.contactDetails?.receiverName ||
    order.customerName ||
    order.customer?.name ||
    "";
  const phone =
    order.contactDetails?.phone ||
    order.customerPhone ||
    order.phone ||
    "";
  return { receiverName, phone };
};

const getPaymentMode = (order = {}) =>
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

const COMPANY_SCANNER_URL = String(import.meta.env?.VITE_COMPANY_SCANNER_URL || "").trim();

const buildCompanyScannerUrl = ({ scanner, order }) => {
  const base = COMPANY_SCANNER_URL;
  if (!base) return "";

  const url = new URL(base, window.location.origin);
  const lockedAmount = Number(
    scanner?.lockedAmount ??
      order?.scannerLockedAmount ??
      order?.amount ??
      order?.total ??
      order?.totalAmount ??
      order?.grandTotal ??
      order?.payableAmount ??
      0
  );

  url.searchParams.set("orderId", String(order?.id || ""));
  url.searchParams.set(
    "orderRef",
    String(order?.orderId || order?.code || order?.number || order?.id || "")
  );
  url.searchParams.set("amount", String(Number.isFinite(lockedAmount) ? lockedAmount : 0));
  if (scanner?.reference) url.searchParams.set("scannerRef", String(scanner.reference));
  if (scanner?.payload) url.searchParams.set("payload", String(scanner.payload));
  if (scanner?.upiId) url.searchParams.set("upiId", String(scanner.upiId));
  if (scanner?.qrImageUrl) url.searchParams.set("qrImageUrl", String(scanner.qrImageUrl));

  return url.toString();
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const invoiceHtml = (order = {}) => {
  const orderRef = getOrderRef(order);
  const customer = getCustomer(order);
  const amount = getAmount(order);
  const items = getItems(order);
  const created = formatDateTime(order.createdAt || order.orderDate || order.date);

  const rows =
    items.length > 0
      ? items
          .map((item, idx) => {
            const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
            const unit = Number(item.price ?? item.unitPrice ?? 0) || 0;
            const total = qty * unit;
            return `<tr>
<td>${idx + 1}</td>
<td>${escapeHtml(item.name || item.title || `Item ${idx + 1}`)}</td>
<td>${qty}</td>
<td>${formatCurrency(unit)}</td>
<td>${formatCurrency(total)}</td>
</tr>`;
          })
          .join("")
      : `<tr><td>1</td><td>Order Total</td><td>1</td><td>${formatCurrency(amount)}</td><td>${formatCurrency(amount)}</td></tr>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Invoice ${escapeHtml(orderRef)}</title>
<style>
body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
table { width: 100%; border-collapse: collapse; margin-top: 16px; }
th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; font-size: 12px; }
th { background: #f8fafc; }
.meta { margin-bottom: 12px; line-height: 1.6; }
</style>
</head>
<body>
<h2>PureCuts Invoice</h2>
<div class="meta">
  <div><strong>Order:</strong> ${escapeHtml(orderRef)}</div>
  <div><strong>Date:</strong> ${escapeHtml(created)}</div>
  <div><strong>Customer:</strong> ${escapeHtml(customer.name)}</div>
  <div><strong>Email:</strong> ${escapeHtml(customer.email)}</div>
  <div><strong>Total:</strong> ${escapeHtml(formatCurrency(amount))}</div>
</div>
<table>
  <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Unit Price</th><th>Line Total</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;
};

export default function OrderDetailsPage() {
  const { id: routeOrderId } = useParams();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [search, setSearch] = useState("");
  const [scannerBusy, setScannerBusy] = useState(false);
  const [paymentSavingId, setPaymentSavingId] = useState("");
  const [scannerViewer, setScannerViewer] = useState({
    open: false,
    url: "",
    scanner: null,
  });
  const [paymentModal, setPaymentModal] = useState({
    open: false,
    paidAmount: "",
    paymentReference: "",
    paymentMethod: "cash",
  });

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
  const contact = getContactDetails(order || {});
  const addressLines = getAddressLines(order || {});
  const items = getItems(order || {});
  const orderAmount = getAmount(order || {});
  const orderStatus = normalizeStatus(order?.orderStatus || order?.status, "placed");
  const paymentStatus = normalizeStatus(order?.paymentStatus, "pending");
  const scannerState = getScannerState(order || {});
  const scanner = order?.codScanner && typeof order.codScanner === "object" ? order.codScanner : null;
  const scannerLockedAmount = Number(
    scanner?.lockedAmount ?? order?.scannerLockedAmount ?? orderAmount
  );
  const showScannerActions = Boolean(order) && isCodOrder(order) && paymentStatus !== "paid";

  const openScannerInDashboard = (scannerData) => {
    const scannerUrl = buildCompanyScannerUrl({
      scanner: scannerData,
      order,
    });

    setScannerViewer({
      open: true,
      url: scannerUrl,
      scanner: scannerData || null,
    });
  };

  const handleGenerateScanner = async (forceRegenerate = false) => {
    if (!order?.id) return;
    if (!isCodOrder(order)) {
      toast.info("Scanner is only available for COD orders");
      return;
    }

    setScannerBusy(true);
    try {
      const createdScanner = await createCodOrderScanner(order.id, {
        forceRegenerate,
        createdBy: "admin_dashboard",
      });
      openScannerInDashboard(createdScanner);
      await loadOrderDetails(order.id);
      toast.success(forceRegenerate ? "Scanner regenerated and opened" : "Scanner generated and opened");
    } catch (error) {
      toast.error(error?.message || "Failed to generate scanner");
    } finally {
      setScannerBusy(false);
    }
  };

  const handleDownloadScanner = async () => {
    if (!order?.id) return;

    setScannerBusy(true);
    try {
      const nextScanner =
        scannerState === "active" && scanner?.qrImageUrl
          ? scanner
          : await createCodOrderScanner(order.id, {
              forceRegenerate: false,
              createdBy: "admin_dashboard",
            });

      openScannerInDashboard(nextScanner);

      await loadOrderDetails(order.id);
      toast.success("Scanner opened in dashboard");
    } catch (error) {
      toast.error(error?.message || "Failed to open scanner");
    } finally {
      setScannerBusy(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!order?.id) return;

    setScannerBusy(true);
    try {
      await markCodOrderScannerPaid(order.id, {
        paymentReference: `dashboard-${Date.now()}`,
        paidBy: "admin_dashboard",
      });
      await loadOrderDetails(order.id);
      toast.success("Scanner payment marked as paid");
    } catch (error) {
      toast.error(error?.message || "Failed to mark scanner payment");
    } finally {
      setScannerBusy(false);
    }
  };

  const handleDownloadInvoice = () => {
    if (!order) return;

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

  const onChangePaymentStatus = async (nextPaymentStatus) => {
    if (!order?.id) return;

    const normalizedNextStatus = normalizeStatus(nextPaymentStatus, "unpaid");

    // Open payment details modal for pending/paid statuses
    if (normalizedNextStatus === "pending" || normalizedNextStatus === "paid") {
      setPaymentModal({
        open: true,
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

    setOrder((prev) => (prev ? { ...prev, ...nextPatch } : null));
    setPaymentSavingId(order.id);

    try {
      await updateOrder(order.id, nextPatch);
      toast.success(`Payment status updated to ${normalizedNextStatus.toUpperCase()}`);
    } catch {
      setOrder((prev) =>
        prev ? { ...prev, paymentStatus: previous } : null
      );
      toast.error("Failed to update payment status");
    } finally {
      setPaymentSavingId("");
    }
  };

  const onSavePaymentDetails = async () => {
    if (!order?.id) {
      toast.error("Order not found");
      return;
    }

    const { paidAmount, paymentReference, paymentMethod, nextStatus } = paymentModal;
    const paid = Number(paidAmount || 0);

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

    setOrder((prev) => (prev ? { ...prev, ...nextPatch } : null));
    setPaymentSavingId(order.id);
    setPaymentModal({ open: false, paidAmount: "", paymentReference: "", paymentMethod: "cash" });

    try {
      await updateOrder(order.id, nextPatch);
      const status = nextStatus.toUpperCase();
      toast.success(`Payment recorded - ${status} (₹${paid.toFixed(2)})`);
    } catch {
      setOrder((prev) =>
        prev ? { ...prev, paymentStatus: order.paymentStatus } : null
      );
      toast.error("Failed to save payment details");
    } finally {
      setPaymentSavingId("");
    }
  };

  return (
    <>
      {scannerViewer.open ? (
        <div className="modal-overlay" onClick={() => setScannerViewer({ open: false, url: "", scanner: null })}>
          <div
            className="modal"
            style={{ maxWidth: 900 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title">Company Scanner</div>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setScannerViewer({ open: false, url: "", scanner: null })}
              >
                Close
              </button>
            </div>
            <div style={{ padding: 16 }}>
              <p className="text-muted" style={{ marginBottom: 10 }}>
                Order: {getOrderRef(order || {})} | Locked Amount: {formatCurrency(scannerViewer.scanner?.lockedAmount || scannerLockedAmount)}
              </p>
              {scannerViewer.url ? (
                <iframe
                  title="Company Scanner"
                  src={scannerViewer.url}
                  style={{ width: "100%", minHeight: 520, border: "1px solid var(--border)", borderRadius: 10 }}
                />
              ) : scannerViewer.scanner?.qrImageUrl ? (
                <div style={{ textAlign: "center" }}>
                  <img
                    src={scannerViewer.scanner.qrImageUrl}
                    alt="Company scanner"
                    width={260}
                    height={260}
                    style={{ border: "1px solid var(--border)", borderRadius: 10 }}
                  />
                  <p className="text-muted" style={{ marginTop: 10 }}>
                    Set VITE_COMPANY_SCANNER_URL in env to load your company scanner page inside dashboard.
                  </p>
                </div>
              ) : (
                <p className="text-muted">No scanner data available.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

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
                <strong>Order:</strong> {getOrderRef(order || {})} | Total: ₹{formatCurrency(orderAmount)}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                  Paid Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  max={orderAmount}
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
                  disabled={paymentSavingId === order?.id}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={onSavePaymentDetails}
                  disabled={paymentSavingId === order?.id}
                >
                  {paymentSavingId === order?.id ? "Saving..." : "Save Payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={handleDownloadInvoice}
                  >
                    <MdReceiptLong /> Download Invoice
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={scannerBusy || !isCodOrder(order) || paymentStatus === "paid"}
                    onClick={handleDownloadScanner}
                  >
                    <MdQrCode2 /> Open Scanner
                  </button>
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
                    Payment Status:
                    <select
                      value={PAYMENT_STATUS_OPTIONS.includes(paymentStatus) ? paymentStatus : "unpaid"}
                      disabled={paymentSavingId === order.id}
                      onChange={(e) => onChangePaymentStatus(e.target.value)}
                      style={{
                        marginLeft: 8,
                        padding: "4px 8px",
                        borderRadius: 4,
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--bg)",
                        color: "var(--text)",
                        cursor: "pointer",
                      }}
                    >
                      {PAYMENT_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </option>
                      ))}
                    </select>
                  </p>
                  {paymentStatus === "paid" && order.paidAmount ? (
                    <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Paid: ₹{Number(order.paidAmount).toFixed(2)} | {String(order.paymentMethod || "cash").toUpperCase()}
                      {order.paymentReference ? ` | Ref: ${order.paymentReference}` : ""}
                    </p>
                  ) : null}
                  {paymentStatus === "pending" ? (
                    <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Pending: ₹{(Number(order.paidAmount || 0) > 0 
                        ? (orderAmount - Number(order.paidAmount || 0)).toFixed(2)
                        : orderAmount.toFixed(2))}
                      {order.paymentReference ? ` | Ref: ${order.paymentReference}` : ""}
                    </p>
                  ) : null}
                  <p>
                    Payment Mode: <strong>{getPaymentMode(order)}</strong>
                  </p>
                  <p>Total: <strong>{formatCurrency(orderAmount)}</strong></p>
                </div>

                {Array.isArray(order.paymentHistory) && order.paymentHistory.length > 0 ? (
                  <div className="order-detail-box full">
                    <h4>Payment History</h4>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 12,
                      }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border)" }}>
                            <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>Status</th>
                            <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>Amount</th>
                            <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>Method</th>
                            <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>Reference</th>
                            <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.paymentHistory.map((payment, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                              <td style={{ padding: 8 }}>
                                <span className={`badge ${payment.status === "paid" ? "badge-green" : payment.status === "pending" ? "badge-orange" : "badge-gray"}`}>
                                  {String(payment.status || "").toUpperCase()}
                                </span>
                              </td>
                              <td style={{ padding: 8 }}>₹{Number(payment.amount || 0).toFixed(2)}</td>
                              <td style={{ padding: 8 }}>{String(payment.method || "—").toUpperCase()}</td>
                              <td style={{ padding: 8 }}>{String(payment.reference || "—")}</td>
                              <td style={{ padding: 8, color: "var(--text-muted)" }}>
                                {payment.updatedAt instanceof Object && typeof payment.updatedAt.toDate === 'function'
                                  ? payment.updatedAt.toDate().toLocaleDateString()
                                  : payment.updatedAt instanceof Date
                                  ? payment.updatedAt.toLocaleDateString()
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

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

                <div className="order-detail-box full">
                  <h4>Contact Details</h4>
                  <p>
                    <strong>{contact.receiverName || "—"}</strong>
                  </p>
                  <p>{contact.phone || "—"}</p>
                </div>

                {isCodOrder(order || {}) ? (
                  <div className="order-detail-box full">
                    <h4>COD Scanner Lock</h4>
                    {paymentStatus === "paid" ? (
                      <p className="scanner-lock-banner success">Payment already completed for this order.</p>
                    ) : (
                      <p className="scanner-lock-banner">
                        Locked amount scanner prevents staff from collecting lower amount.
                      </p>
                    )}
                    <p>
                      Scanner State: <span className={`badge ${scannerBadgeClass(scannerState)}`}>
                        {scannerState.toUpperCase()}
                      </span>
                    </p>
                    <p>
                      Locked Amount: <strong>{formatCurrency(scannerLockedAmount)}</strong>
                    </p>
                    {scanner?.reference ? (
                      <p>
                        Scanner Ref: <strong>{scanner.reference}</strong>
                      </p>
                    ) : null}
                    {scanner?.qrImageUrl ? (
                      <div style={{ marginTop: 10 }}>
                        <img
                          src={scanner.qrImageUrl}
                          alt="Order scanner QR"
                          width={180}
                          height={180}
                          style={{ border: "1px solid var(--border)", borderRadius: 10 }}
                        />
                      </div>
                    ) : null}
                    {showScannerActions ? (
                      <div className="scanner-actions" style={{ marginTop: 12 }}>
                        <button
                          className="btn btn-outline btn-sm"
                          disabled={scannerBusy}
                          onClick={() => handleGenerateScanner(scannerState === "active")}
                        >
                          <MdQrCode2 /> {scannerState === "active" ? "Regenerate Scanner" : "Generate Scanner"}
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          disabled={scannerBusy}
                          onClick={handleDownloadScanner}
                        >
                          <MdQrCode2 /> Open Scanner
                        </button>
                        {scannerState === "active" ? (
                          <button
                            className="btn btn-success btn-sm"
                            disabled={scannerBusy}
                            onClick={handleMarkPaid}
                          >
                            <MdDone /> Mark Scanner Paid
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
