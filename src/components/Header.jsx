import { useLocation } from "react-router-dom";
import { MdNotifications, MdSearch } from "react-icons/md";

const titles = {
  "/products":       "Products",
  "/products/add":   "Add Product",
  "/brands":         "Brands",
  "/categories":     "Categories",
  "/subcategories":  "Sub Categories",
};

function getTitle(pathname) {
  if (pathname.startsWith("/products/edit/")) return "Edit Product";
  return titles[pathname] || "Dashboard";
}

export default function Header() {
  const { pathname } = useLocation();
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
        <div className="avatar">A</div>
      </div>
    </header>
  );
}
