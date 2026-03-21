import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  MdAdd,
  MdContentPaste,
  MdDeleteOutline,
  MdNotificationsActive,
  MdSearch,
  MdTravelExplore,
} from "react-icons/md";
import {
  createBroadcastNotification,
  createOrderNotification,
  deleteNotification,
  getNotifications,
  getOrders,
  getUsers,
  updateOrder,
} from "../../firestoreService";

const STATUS_OPTIONS = ["process", "conformed", "packed", "dispatched"];
const BROADCAST_TYPES = ["discount", "sale", "new_arrival", "offer", "custom"];

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value) => {
  const dt = toDate(value);
  return dt ? dt.toLocaleString() : "-";
};

const normalizeRole = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "");

const isAdminLikeUser = (user = {}) => {
  const role = normalizeRole(user.role);
  return role === "admin" || role === "superadmin" || role === "staff";
};

const userKey = (user = {}) =>
  String(user.uid || user.id || user.userId || "").trim();

const getOrderRef = (order) => order.orderId || order.code || order.number || order.id || "-";

const getCustomer = (order) => ({
  name: order.customerName || order.customer?.name || order.userName || "Unknown Customer",
  phone: order.phone || order.customerPhone || order.customer?.phone || order.userPhone || "",
});

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

const orderTemplate = (status, order = {}) => {
  const productLabel = getOrderProductLabel(order);

  if (status === "dispatched") {
    return {
      title: `Order Dispatched: ${productLabel}`,
      message: `Your order for ${productLabel} has been dispatched.`,
    };
  }

  if (status === "conformed") {
    return {
      title: `Order Confirmed: ${productLabel}`,
      message: `Your order for ${productLabel} is confirmed and being prepared.`,
    };
  }

  if (status === "packed") {
    return {
      title: `Order Packed: ${productLabel}`,
      message: `Your order for ${productLabel} has been packed and will be dispatched soon.`,
    };
  }

  return {
    title: `Order In Process: ${productLabel}`,
    message: `Your order for ${productLabel} is currently being processed.`,
  };
};

const broadcastTemplate = (type) => {
  if (type === "discount") return { title: "Special Discount For You", message: "Enjoy exclusive discounts today. Open the app now." };
  if (type === "sale") return { title: "Mega Sale Live Now", message: "Big sale is live. Shop now before stock runs out." };
  if (type === "new_arrival") return { title: "New Arrivals Are Here", message: "Fresh products are now available in the app." };
  if (type === "offer") return { title: "Limited Time Offer", message: "A limited time offer is waiting for you in the app." };
  return { title: "Important Update", message: "Please check the app for the latest update." };
};

export default function NotificationsPage() {
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [search, setSearch] = useState("");

  const [targetType, setTargetType] = useState("order");
  const [orderLookup, setOrderLookup] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [status, setStatus] = useState("process");
  const [broadcastType, setBroadcastType] = useState("discount");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sendApp, setSendApp] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [updateOrderStatus, setUpdateOrderStatus] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [orderData, notificationData, usersData] = await Promise.all([
        getOrders(),
        getNotifications(),
        getUsers(),
      ]);
      setOrders(orderData);
      setNotifications(notificationData);
      setUsers(usersData);
    } catch {
      toast.error("Failed to load notifications data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  const broadcastRecipients = useMemo(() => {
    const unique = new Map();

    users.forEach((user) => {
      if (isAdminLikeUser(user)) return;
      if (user.active === false) return;

      const key = userKey(user);
      if (!key) return;

      if (!unique.has(key)) {
        unique.set(key, user);
      }
    });

    return Array.from(unique.values());
  }, [users]);

  const findOrderByLookup = () => {
    const needle = orderLookup.trim().toLowerCase().replace(/^#/, "");
    if (!needle) {
      toast.error("Enter an order ID first");
      return;
    }

    const found = orders.find((order) => {
      const idCandidates = [
        order.id,
        order.orderId,
        order.code,
        order.number,
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase().replace(/^#/, ""));
      return idCandidates.includes(needle);
    });

    if (!found) {
      setSelectedOrderId("");
      toast.error("Order not found");
      return;
    }

    setSelectedOrderId(found.id);
    toast.success(`Order #${getOrderRef(found)} loaded`);
  };

  const pasteOrderIdFromClipboard = async () => {
    try {
      if (!navigator?.clipboard?.readText) {
        toast.error("Clipboard access is not available in this browser");
        return;
      }

      const text = (await navigator.clipboard.readText())?.trim();
      if (!text) {
        toast.error("Clipboard is empty");
        return;
      }

      setOrderLookup(text);
      toast.success("Order ID pasted from clipboard");
    } catch {
      toast.error("Could not read clipboard. Please allow clipboard permission.");
    }
  };

  useEffect(() => {
    if (targetType === "order") {
      if (!selectedOrder) {
        setTitle("");
        setMessage("");
        return;
      }
      const tpl = orderTemplate(status, selectedOrder);
      setTitle(tpl.title);
      setMessage(tpl.message);
      return;
    }

    const tpl = broadcastTemplate(broadcastType);
    setTitle(tpl.title);
    setMessage(tpl.message);
  }, [targetType, selectedOrder, status, broadcastType]);

  const filteredNotifications = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notifications;
    return notifications.filter((n) =>
      String(n.title || "").toLowerCase().includes(q) ||
      String(n.message || "").toLowerCase().includes(q) ||
      String(n.customerName || "").toLowerCase().includes(q) ||
      String(n.orderRef || "").toLowerCase().includes(q)
    );
  }, [notifications, search]);

  const onCreateNotification = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required");
      return;
    }

    if (targetType === "order" && !selectedOrder) {
      toast.error("Please select an order");
      return;
    }

    if (targetType === "order" && !sendApp && !sendSms) {
      toast.error("Select at least one channel (App or SMS)");
      return;
    }

    if (targetType === "broadcast" && !sendApp) {
      toast.error("Select at least one channel (App)");
      return;
    }

    if (targetType === "order") {
      const customer = getCustomer(selectedOrder);
      if (sendSms && !customer.phone) {
        toast.error("Selected order has no phone number for SMS");
        return;
      }
    }

    setSaving(true);
    try {
      if (targetType === "order") {
        await createOrderNotification({
          order: selectedOrder,
          status,
          title: title.trim(),
          message: message.trim(),
          sendApp,
          sendSms,
          sendWhatsapp: false,
          createdBy: "admin",
        });

        if (updateOrderStatus) {
          await updateOrder(selectedOrder.id, { orderStatus: status });
        }
      } else {
        await createBroadcastNotification({
          title: title.trim(),
          message: message.trim(),
          type: broadcastType,
          users: broadcastRecipients,
          sendApp,
          sendWhatsapp: false,
          createdBy: "admin",
        });
      }

      toast.success("Notification sent successfully");
      load();
    } catch (error) {
      const messageText =
        error?.message || error?.code || "Failed to send notification";
      toast.error(`Failed to send notification: ${messageText}`);
    } finally {
      setSaving(false);
    }
  };

  const onDeleteNotification = async (notificationId) => {
    const id = String(notificationId || "").trim();
    if (!id) return;

    const ok = window.confirm("Delete this notification? This action cannot be undone.");
    if (!ok) return;

    setDeletingId(id);
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success("Notification deleted");
    } catch (error) {
      const messageText = error?.message || error?.code || "Failed to delete notification";
      toast.error(`Failed to delete notification: ${messageText}`);
    } finally {
      setDeletingId("");
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>All Notifications</h2>
          <div className="breadcrumb">Home / <span>All Notifications</span></div>
        </div>
      </div>

      <div className="notifications-editor-layout">
        <div className="card notification-create-card">
          <div className="card-header">
            <span className="card-title">Create New Notification</span>
          </div>
          <form onSubmit={onCreateNotification}>
            <div className="form-grid single">
              <div className="form-group">
                <label>Target</label>
                <div className="notification-target-toggle">
                  <button
                    type="button"
                    className={`target-chip ${targetType === "order" ? "active" : ""}`}
                    onClick={() => setTargetType("order")}
                  >
                    Specific Order
                  </button>
                  <button
                    type="button"
                    className={`target-chip ${targetType === "broadcast" ? "active" : ""}`}
                    onClick={() => setTargetType("broadcast")}
                  >
                    All Users
                  </button>
                </div>
              </div>

              {targetType === "order" ? (
                <>
                  <div className="form-group">
                    <label>Find Order by ID *</label>
                    <div className="order-fetch-row">
                      <input
                        value={orderLookup}
                        onChange={(e) => setOrderLookup(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            findOrderByLookup();
                          }
                        }}
                        placeholder="Enter order id like #abc123"
                      />
                      <button type="button" className="btn btn-outline" onClick={pasteOrderIdFromClipboard}>
                        <MdContentPaste /> Paste
                      </button>
                      <button type="button" className="btn btn-outline" onClick={findOrderByLookup}>
                        <MdTravelExplore /> Fetch
                      </button>
                    </div>
                  </div>

                  {selectedOrder ? (
                    <div className="selected-order-card">
                      <div className="font-medium">Order #{getOrderRef(selectedOrder)}</div>
                      <div className="text-muted">{getCustomer(selectedOrder).name}</div>
                    </div>
                  ) : (
                    <div className="selected-order-card muted">No order selected</div>
                  )}

                  <div className="form-group">
                    <label>Order Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                      {STATUS_OPTIONS.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>Broadcast Type</label>
                    <select value={broadcastType} onChange={(e) => setBroadcastType(e.target.value)}>
                      {BROADCAST_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="selected-order-card">
                    Broadcasting to {broadcastRecipients.length} users
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Title *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Message *</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} required />
              </div>

              <div className="notify-channel-grid">
                <label className="notify-check">
                  <input type="checkbox" checked={sendApp} onChange={(e) => setSendApp(e.target.checked)} />
                  Show in app
                </label>
                <label className="notify-check">
                  <input
                    type="checkbox"
                    checked={sendSms}
                    onChange={(e) => setSendSms(e.target.checked)}
                    disabled={targetType !== "order"}
                  />
                  Send SMS (order only)
                </label>
                <label className="notify-check">
                  <input
                    type="checkbox"
                    checked={updateOrderStatus}
                    onChange={(e) => setUpdateOrderStatus(e.target.checked)}
                    disabled={targetType !== "order"}
                  />
                  Update order status
                </label>
              </div>
            </div>

            <div className="form-footer">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                <MdAdd /> {saving ? "Sending..." : "Send Notification"}
              </button>
            </div>
          </form>
        </div>

        <div className="card notification-help-card">
          <div className="card-header"><span className="card-title">How It Works</span></div>
          <div className="notification-help-body">
            <p>1. Choose Specific Order or All Users.</p>
            <p>2. For order mode, enter order ID and click Fetch.</p>
            <p>3. Select channels (App, SMS).</p>
            <p>4. Send and track in the table below.</p>
          </div>
        </div>
      </div>

      <div className="search-wrap notifications-search-wrap">
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
        ) : filteredNotifications.length === 0 ? (
          <div className="empty-state">
            <MdNotificationsActive />
            <p>No notifications sent yet.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ser</th>
                  <th>Notification</th>
                  <th>Type</th>
                  <th>Sent</th>
                  <th>Date</th>
                  <th>Channel</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotifications.map((item, i) => (
                  <tr key={item.id}>
                    <td className="text-muted">{i + 1}</td>
                    <td>
                      <div className="font-medium">{item.title || "-"}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>{item.message || "-"}</div>
                    </td>
                    <td><span className="badge badge-blue">{item.type || "custom"}</span></td>
                    <td>
                      <div className="font-medium">{item.customerName || (item.audience === "all_users" ? "All Users" : "-")}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        {item.orderRef ? `#${String(item.orderRef).replace(/^#/, "")}` : "-"}
                      </div>
                    </td>
                    <td className="text-muted">{formatDateTime(item.sentAt || item.createdAt)}</td>
                    <td>
                      <div className="flex gap-2">
                        {item.channels?.app ? <span className="badge badge-green">App</span> : null}
                        {item.channels?.sms ? <span className="badge badge-blue">SMS</span> : null}
                        {item.channels?.whatsapp ? <span className="badge badge-orange">WP</span> : null}
                        {!item.channels?.app && !item.channels?.sms && !item.channels?.whatsapp ? (
                          <span className="badge badge-gray">Unknown</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => onDeleteNotification(item.id)}
                        disabled={deletingId === item.id}
                      >
                        <MdDeleteOutline /> {deletingId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
