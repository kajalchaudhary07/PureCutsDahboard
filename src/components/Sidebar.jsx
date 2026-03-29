import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { collection, collectionGroup, onSnapshot } from "firebase/firestore";
import { useAuth } from "../auth/AuthProvider";
import { db } from "../firebaseConfig";
import {
  MdDashboard,
  MdPermMedia,
  MdCategory,
  MdAccountTree,
  MdBrandingWatermark,
  MdTune,
  MdStraighten,
  MdAddBox,
  MdInventory2,
  MdPeople,
  MdHowToReg,
  MdShoppingCart,
  MdReceiptLong,
  MdRateReview,
  MdViewCarousel,
  MdLocalOffer,
  MdNotificationsNone,
  MdChatBubbleOutline,
  MdSmartToy,
  MdAdminPanelSettings,
  MdBadge,
  MdPerson,
  MdSettings,
  MdStorefront,
} from "react-icons/md";

const menuSections = [
  {
    group: "Overview & Media",
    items: [
      { label: "Dashboard", path: "/dashboard", icon: <MdDashboard /> },
      { label: "Media", path: "/media", icon: <MdPermMedia /> },
    ],
  },
  {
    group: "Data Management",
    items: [
      { label: "Categories", path: "/categories", icon: <MdCategory /> },
      { label: "Sub Categories", path: "/subcategories", icon: <MdAccountTree /> },
      { label: "Sub Sub Categories", path: "/subsubcategories", icon: <MdAccountTree /> },
      { label: "Brands", path: "/brands", icon: <MdBrandingWatermark /> },
      { label: "Attributes", path: "/attributes", icon: <MdTune /> },
      { label: "Units", path: "/units", icon: <MdStraighten /> },
    ],
  },
  {
    group: "Product Management",
    items: [
      { label: "Add new product", path: "/products/add", icon: <MdAddBox /> },
      { label: "Products", path: "/products", icon: <MdInventory2 />, end: true },
      { label: "Customers", path: "/customers", icon: <MdPeople /> },
      { label: "New Users", path: "/new-users", icon: <MdHowToReg /> },
      { label: "Orders", path: "/orders", icon: <MdShoppingCart /> },
      { label: "Order Details", path: "/order-details", icon: <MdReceiptLong /> },
      { label: "Product Reviews", path: "/product-reviews", icon: <MdRateReview /> },
    ],
  },
  {
    group: "Promotion Management",
    items: [
      { label: "Banners", path: "/banners", icon: <MdViewCarousel /> },
      { label: "Coupons", path: "/coupons", icon: <MdLocalOffer /> },
    ],
  },
  {
    group: "Notification",
    items: [{ label: "Notifications", path: "/notifications", icon: <MdNotificationsNone /> }],
  },
  {
    group: "Support Management",
    items: [
      { label: "Chat", path: "/chat", icon: <MdChatBubbleOutline /> },
      { label: "Support Bot", path: "/support-bot", icon: <MdSmartToy /> },
    ],
  },
  {
    group: "Admin Management",
    items: [{ label: "Admin", path: "/admin", icon: <MdAdminPanelSettings /> }],
  },
  {
    group: "Role Management",
    items: [{ label: "Roles", path: "/roles", icon: <MdBadge /> }],
  },
  {
    group: "Configurations",
    dividerBefore: true,
    items: [
      { label: "Profile", path: "/profile", icon: <MdPerson /> },
      { label: "App Settings", path: "/app-settings", icon: <MdSettings /> },
      { label: "Image Resolution Guide", path: "/image-guide", icon: <MdPermMedia /> },
    ],
  },
];

const PATH_RESOURCE_MAP = {
  "/dashboard": "Dashboard",
  "/media": "Media",
  "/categories": "Category",
  "/subcategories": "Sub-Category",
  "/subsubcategories": "Sub-Category",
  "/attributes": "Attributes",
  "/units": "Attributes",
  "/brands": "Brands",
  "/products": "Products",
  "/products/add": "Products",
  "/customers": "Customers",
  "/new-users": "Customers",
  "/orders": "Orders",
  "/order-details": "Orders",
  "/product-reviews": "Products",
  "/banners": "Media",
  "/coupons": "Media",
  "/notifications": "Media",
  "/chat": "Customers",
  "/support-bot": "Customers",
  "/admin": "Customers",
  "/roles": "Customers",
  "/profile": "Customers",
  "/app-settings": "Customers",
  "/image-guide": "Media",
};

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const isPendingVerificationRequest = (request = {}) => {
  const status = normalizeStatus(request.status);
  if (status) return status === "pending";
  if (request.approved === true || request.rejected === true) return false;
  return true;
};

const isPendingReview = (review = {}) => {
  const status = normalizeStatus(review.status);
  if (status) return status !== "approved";
  if (review.approved === true) return false;
  return true;
};

const isNewOrder = (order = {}) => {
  const status = normalizeStatus(order.orderStatus || order.status);
  if (!status) return true;

  const cancelledBy = normalizeStatus(order.cancelledBy || order.canceledBy);
  const cancelSource = normalizeStatus(order.cancellationSource || order.cancelSource);
  const cancelledByUser =
    status === "cancelled" &&
    (cancelledBy.includes("user") ||
      cancelledBy.includes("customer") ||
      cancelSource.includes("user") ||
      cancelSource.includes("customer") ||
      cancelSource.includes("app_user"));

  return status === "placed" || status === "pending" || cancelledByUser;
};

const formatBadge = (count) => {
  const safe = Number(count || 0);
  if (safe <= 0) return "";
  if (safe > 99) return "99+";
  return String(safe);
};

const badgeKeyForPathname = (pathname = "") => {
  const path = String(pathname || "").toLowerCase();
  if (path.startsWith("/new-users")) return "newUsers";
  if (path.startsWith("/orders") || path.startsWith("/order-details")) {
    return "orders";
  }
  if (path.startsWith("/product-reviews")) return "reviews";
  if (path.startsWith("/chat")) return "chats";
  return "";
};

function NavItem({ item, badgeText }) {
  return (
    <NavLink
      to={item.path}
      end={item.end}
      className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
    >
      {item.icon}
      <span className="nav-item-label">{item.label}</span>
      {badgeText ? <span className="nav-alert-badge">{badgeText}</span> : null}
    </NavLink>
  );
}

export default function Sidebar() {
  const { hasPermission, isSuperAdmin } = useAuth();
  const location = useLocation();
  const [badgeCounts, setBadgeCounts] = useState({
    newUsers: 0,
    orders: 0,
    reviews: 0,
    chats: 0,
  });
  const [seenBadgeCounts, setSeenBadgeCounts] = useState({
    newUsers: 0,
    orders: 0,
    reviews: 0,
    chats: 0,
  });

  const canView = (item) => {
    if (isSuperAdmin) return true;
    const resource = PATH_RESOURCE_MAP[item.path];
    if (!resource) return true;
    return hasPermission(resource, "view");
  };

  const visibleSections = menuSections
    .map((group) => ({
      ...group,
      items: group.items.filter(canView),
    }))
    .filter((group) => group.items.length > 0);

  useEffect(() => {
    const unsubscribers = [];

    const unsubRequests = onSnapshot(
      collection(db, "verificationRequests"),
      (snap) => {
        const pending = snap.docs.reduce((sum, docSnap) => {
          return sum + (isPendingVerificationRequest(docSnap.data() || {}) ? 1 : 0);
        }, 0);
        setBadgeCounts((prev) => ({ ...prev, newUsers: pending }));
      },
      () => {
        setBadgeCounts((prev) => ({ ...prev, newUsers: 0 }));
      }
    );
    unsubscribers.push(unsubRequests);

    const unsubOrders = onSnapshot(
      collection(db, "orders"),
      (snap) => {
        const pending = snap.docs.reduce((sum, docSnap) => {
          return sum + (isNewOrder(docSnap.data() || {}) ? 1 : 0);
        }, 0);
        setBadgeCounts((prev) => ({ ...prev, orders: pending }));
      },
      () => {
        setBadgeCounts((prev) => ({ ...prev, orders: 0 }));
      }
    );
    unsubscribers.push(unsubOrders);

    const pendingReviewsByKey = new Map();
    const syncReviewsBadge = () => {
      let total = 0;
      pendingReviewsByKey.forEach((value) => {
        total += Number(value || 0);
      });
      setBadgeCounts((prev) => ({ ...prev, reviews: total }));
    };

    const unsubTopLevelReviews = onSnapshot(
      collection(db, "productReviews"),
      (snap) => {
        const pending = snap.docs.reduce((sum, docSnap) => {
          return sum + (isPendingReview(docSnap.data() || {}) ? 1 : 0);
        }, 0);
        pendingReviewsByKey.set("productReviews", pending);
        syncReviewsBadge();
      },
      () => {
        pendingReviewsByKey.set("productReviews", 0);
        syncReviewsBadge();
      }
    );
    unsubscribers.push(unsubTopLevelReviews);

    const unsubNestedReviews = onSnapshot(
      collectionGroup(db, "reviews"),
      (snap) => {
        const pending = snap.docs.reduce((sum, docSnap) => {
          return sum + (isPendingReview(docSnap.data() || {}) ? 1 : 0);
        }, 0);
        pendingReviewsByKey.set("nestedReviews", pending);
        syncReviewsBadge();
      },
      () => {
        pendingReviewsByKey.set("nestedReviews", 0);
        syncReviewsBadge();
      }
    );
    unsubscribers.push(unsubNestedReviews);

    const unsubChats = onSnapshot(
      collection(db, "chats"),
      (snap) => {
        const unread = snap.docs.reduce((sum, docSnap) => {
          const value = Number(docSnap.data()?.unreadForAdmin || 0);
          return sum + (Number.isFinite(value) ? value : 0);
        }, 0);
        setBadgeCounts((prev) => ({ ...prev, chats: unread }));
      },
      () => {
        setBadgeCounts((prev) => ({ ...prev, chats: 0 }));
      }
    );
    unsubscribers.push(unsubChats);

    return () => {
      unsubscribers.forEach((unsub) => {
        if (typeof unsub === "function") unsub();
      });
    };
  }, []);

  useEffect(() => {
    const key = badgeKeyForPathname(location.pathname);
    if (!key) return;

    setSeenBadgeCounts((prev) => {
      const currentSeen = Number(prev[key] || 0);
      const currentCount = Number(badgeCounts[key] || 0);
      if (currentSeen >= currentCount) return prev;
      return {
        ...prev,
        [key]: currentCount,
      };
    });
  }, [location.pathname, badgeCounts]);

  const unreadBadgeCounts = useMemo(
    () => ({
      newUsers: Math.max(0, Number(badgeCounts.newUsers || 0) - Number(seenBadgeCounts.newUsers || 0)),
      orders: Math.max(0, Number(badgeCounts.orders || 0) - Number(seenBadgeCounts.orders || 0)),
      reviews: Math.max(0, Number(badgeCounts.reviews || 0) - Number(seenBadgeCounts.reviews || 0)),
      chats: Math.max(0, Number(badgeCounts.chats || 0) - Number(seenBadgeCounts.chats || 0)),
    }),
    [badgeCounts, seenBadgeCounts]
  );

  const badgeByPath = useMemo(
    () => ({
      "/new-users": formatBadge(unreadBadgeCounts.newUsers),
      "/orders": formatBadge(unreadBadgeCounts.orders),
      "/product-reviews": formatBadge(unreadBadgeCounts.reviews),
      "/chat": formatBadge(unreadBadgeCounts.chats),
    }),
    [unreadBadgeCounts]
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <MdStorefront />
        </div>
        <span>PureCuts</span>
      </div>

      <nav className="sidebar-nav">
        {visibleSections.map((group) => (
          <div key={group.group} className="nav-group">
            {group.dividerBefore && <div className="nav-divider" />}
            <div className="nav-group-title">{group.group}</div>
            {group.items.map((item) => (
              <NavItem
                key={item.label}
                item={item}
                badgeText={badgeByPath[item.path] || ""}
              />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
