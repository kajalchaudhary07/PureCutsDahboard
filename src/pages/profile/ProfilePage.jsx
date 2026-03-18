import { useMemo, useState } from "react";
import { MdSave } from "react-icons/md";
import { useAuth } from "../../auth/AuthProvider";

export default function ProfilePage() {
  const { user, claims } = useAuth();
  const [name, setName] = useState(user?.displayName || "");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("Purecuts");
  const [savedAt, setSavedAt] = useState("");

  const role = useMemo(() => {
    if (claims.superAdmin) return "Super Admin";
    if (claims.admin) return "Admin";
    return "Staff";
  }, [claims]);

  const save = (event) => {
    event.preventDefault();
    setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Profile</h2>
          <div className="breadcrumb">Home / <span>Profile</span></div>
        </div>
      </div>

      <div className="profile-layout">
        <section className="card profile-side-card">
          <div className="profile-avatar">{(user?.email || "A").charAt(0).toUpperCase()}</div>
          <h3>{name || "Admin User"}</h3>
          <p>{user?.email || "-"}</p>
          <span className="badge badge-blue">{role}</span>
        </section>

        <section className="card">
          <div className="card-header">
            <span className="card-title">Account Details</span>
          </div>
          <form className="form-grid" onSubmit={save}>
            <div className="form-group">
              <label>Full Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Admin name" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input value={user?.email || ""} disabled />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91..." />
            </div>
            <div className="form-group">
              <label>Company</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="form-footer form-group full">
              {savedAt ? <span className="text-muted">Saved at {savedAt}</span> : <span />}
              <button className="btn btn-primary" type="submit"><MdSave /> Save Profile</button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
