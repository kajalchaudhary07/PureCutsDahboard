import { NavLink } from "react-router-dom";
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
    ],
  },
];

function NavItem({ item }) {
  return (
    <NavLink
      to={item.path}
      end={item.end}
      className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
    >
      {item.icon}
      {item.label}
    </NavLink>
  );
}

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <MdStorefront />
        </div>
        <span>PureCuts</span>
      </div>

      <nav className="sidebar-nav">
        {menuSections.map((group) => (
          <div key={group.group} className="nav-group">
            {group.dividerBefore && <div className="nav-divider" />}
            <div className="nav-group-title">{group.group}</div>
            {group.items.map((item) => (
              <NavItem key={item.label} item={item} />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
