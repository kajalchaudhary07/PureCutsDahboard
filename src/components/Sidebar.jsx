import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  MdDashboard,
  MdInventory2,
  MdAddBox,
  MdList,
  MdBrandingWatermark,
  MdCategory,
  MdAccountTree,
  MdChevronRight,
  MdStorefront,
} from "react-icons/md";

const menuItems = [
  {
    group: "Main Menu",
    items: [
      {
        label: "Products",
        icon: <MdInventory2 />,
        children: [
          { label: "All Products", path: "/products", icon: <MdList /> },
          { label: "Add Product",  path: "/products/add", icon: <MdAddBox /> },
        ],
      },
      { label: "Brands",          path: "/brands",        icon: <MdBrandingWatermark /> },
      { label: "Categories",      path: "/categories",    icon: <MdCategory /> },
      { label: "Sub Categories",  path: "/subcategories", icon: <MdAccountTree /> },
    ],
  },
];

function NavGroup({ item }) {
  const location = useLocation();
  const isChildActive = item.children?.some((c) =>
    location.pathname.startsWith(c.path)
  );
  const [open, setOpen] = useState(isChildActive);

  if (item.children) {
    return (
      <div className="nav-group">
        <div
          className={`nav-item ${isChildActive ? "active" : ""}`}
          onClick={() => setOpen((o) => !o)}
        >
          {item.icon}
          <span style={{ flex: 1 }}>{item.label}</span>
          <MdChevronRight
            className={`nav-expand ${open ? "open" : ""}`}
          />
        </div>
        {open && (
          <div className="nav-sub">
            {item.children.map((child) => (
              <NavLink
                key={child.path}
                to={child.path}
                end
                className={({ isActive }) =>
                  `nav-item${isActive ? " active" : ""}`
                }
              >
                {child.icon}
                {child.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
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
        <span>T Store</span>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((group) => (
          <div key={group.group}>
            <div className="nav-group-title">{group.group}</div>
            {group.items.map((item) => (
              <NavGroup key={item.label} item={item} />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
