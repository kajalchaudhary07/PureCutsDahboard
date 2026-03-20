import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { MdSave } from "react-icons/md";
import { getRolePermissions, saveRolePermissions } from "../../firestoreService";
import { useAuth } from "../../auth/AuthProvider";

const ROLES = ["Demo", "User", "Admin", "Unknown"];
const RESOURCES = [
  "Media",
  "Category",
  "Sub-Category",
  "Attributes",
  "Brands",
  "Products",
  "Orders",
  "Customers",
];
const ACTIONS = ["view", "create", "update", "delete"];

const defaultPermissions = (roleName) => {
  if (roleName === "Admin") {
    return RESOURCES.map((resource) => ({
      resource,
      view: true,
      create: true,
      update: true,
      delete: true,
    }));
  }

  if (roleName === "User") {
    return RESOURCES.map((resource) => ({
      resource,
      view: true,
      create: false,
      update: false,
      delete: false,
    }));
  }

  return RESOURCES.map((resource) => ({
    resource,
    view: false,
    create: false,
    update: false,
    delete: false,
  }));
};

const normalizePermissions = (rawPermissions, roleName) => {
  const fallback = defaultPermissions(roleName);
  if (!Array.isArray(rawPermissions)) return fallback;

  return RESOURCES.map((resource) => {
    const found = rawPermissions.find((r) => r.resource === resource);
    const defaults = fallback.find((r) => r.resource === resource);
    return {
      resource,
      view: Boolean(found?.view ?? defaults.view),
      create: Boolean(found?.create ?? defaults.create),
      update: Boolean(found?.update ?? defaults.update),
      delete: Boolean(found?.delete ?? defaults.delete),
    };
  });
};

export default function RolesManagement() {
  const { isSuperAdmin } = useAuth();
  const [selectedRole, setSelectedRole] = useState("Admin");
  const [permissions, setPermissions] = useState(defaultPermissions("Admin"));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const activeRoleLabel = useMemo(() => selectedRole || "Admin", [selectedRole]);

  const loadRole = async (roleName) => {
    setLoading(true);
    try {
      const saved = await getRolePermissions(roleName);
      setPermissions(normalizePermissions(saved?.permissions, roleName));
    } catch {
      toast.error("Failed to load permissions");
      setPermissions(defaultPermissions(roleName));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRole(selectedRole);
  }, [selectedRole]);

  const togglePermission = (resource, action) => {
    if (!isSuperAdmin) return;
    setPermissions((prev) =>
      prev.map((row) =>
        row.resource === resource
          ? { ...row, [action]: !row[action] }
          : row
      )
    );
  };

  const saveCurrentRole = async () => {
    if (!isSuperAdmin) {
      toast.error("Only super admins can save role permissions.");
      return;
    }

    setSaving(true);
    try {
      await saveRolePermissions(selectedRole, permissions);
      toast.success(`${selectedRole} permissions saved`);
    } catch {
      toast.error("Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Role Permissions</h2>
          <div className="breadcrumb">Home / <span>Roles</span></div>
        </div>
        <button className="btn btn-primary" onClick={saveCurrentRole} disabled={saving || loading}>
          <MdSave /> {saving ? "Saving..." : "Save Permissions"}
        </button>
      </div>

      {!isSuperAdmin ? (
        <div className="text-muted" style={{ marginBottom: 12, fontSize: 12 }}>
          Read-only mode: only super admins can modify role permissions.
        </div>
      ) : null}

      <div className="roles-layout">
        <div className="card roles-menu-card">
          <div className="roles-menu-title">Roles</div>
          <div className="roles-menu-list">
            {ROLES.map((role) => (
              <button
                key={role}
                className={`roles-menu-item ${selectedRole === role ? "active" : ""}`}
                onClick={() => setSelectedRole(role)}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">All {activeRoleLabel} Permissions</span>
          </div>

          {loading ? (
            <div className="spinner-wrap"><div className="spinner" /></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Permission</th>
                    <th>View</th>
                    <th>Create</th>
                    <th>Update</th>
                    <th>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((row) => (
                    <tr key={row.resource}>
                      <td className="font-medium">{row.resource}</td>
                      {ACTIONS.map((action) => (
                        <td key={action}>
                          <label className="perm-check-wrap" aria-label={`${row.resource} ${action}`}>
                            <input
                              type="checkbox"
                              checked={row[action]}
                              onChange={() => togglePermission(row.resource, action)}
                              disabled={!isSuperAdmin}
                            />
                          </label>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
