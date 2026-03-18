import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

const titles = {
  "/dashboard":      "Dashboard",
  "/media":          "Media",
  "/products":       "Products",
  "/products/add":   "Add Product",
  "/brands":         "Brands",
  "/categories":     "Categories",
  "/subcategories":  "Sub Categories",
  "/attributes":     "Attributes",
  "/units":          "Units",
  "/customers":      "Customers",
  "/orders":         "Orders",
  "/product-reviews": "Product Reviews",
  "/banners":        "Banners",
  "/coupons":        "Coupons",
  "/notifications":  "Notifications",
  "/chat":           "Chat",
  "/admin":          "Admin",
  "/roles":          "Roles",
  "/profile":        "Profile",
  "/app-settings":   "App Settings",
};

function getTitle(pathname) {
  if (pathname.startsWith("/products/edit/")) return "Edit Product";
  return titles[pathname] || "Dashboard";
}

export default function Header() {
  const { pathname } = useLocation();
  const { user, logout, claims } = useAuth();
  
  const title = getTitle(pathname);

  const parts = pathname.split("/").filter(Boolean);
  const crumbs = ["Home", ...parts.map((p) =>
    p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, " ")
  )];

  return (
    <header className="topbar">
      <div>
        <div className="topbar-title">{title}</div>
        <div className="breadcrumb">
          {crumbs.map((c, i) => (
            <span key={i}>
              {i > 0 && " / "}
              {i === crumbs.length - 1 ? <span>{c}</span> : c}
            </span>
          ))}
        </div>
      </div>
      <div className="topbar-right">
        <div className="topbar-user-meta">
          <div className="topbar-user-email">{user?.email || "Unknown user"}</div>
          <div className="topbar-user-role">
            {claims.superAdmin ? "Super Admin" : claims.admin ? "Admin" : "Staff"}
          </div>
        </div>
        <div className="avatar">
          {(user?.email || "A").trim().charAt(0).toUpperCase()}
        </div>
        <button className="btn btn-outline btn-sm" onClick={logout}>
          Sign out
        </button>
      </div>
    </header>
  );
}
