import { useMemo, useState } from "react";
import { MdAdd, MdDelete } from "react-icons/md";

const INITIAL_COUPONS = [
  { id: "cp-1", code: "WELCOME10", type: "percent", value: 10, minOrder: 499, active: true },
  { id: "cp-2", code: "SAVE150", type: "flat", value: 150, minOrder: 1200, active: true },
];

export default function CouponsPage() {
  const [coupons, setCoupons] = useState(INITIAL_COUPONS);
  const [code, setCode] = useState("");
  const [type, setType] = useState("percent");
  const [value, setValue] = useState("");
  const [minOrder, setMinOrder] = useState("");

  const active = useMemo(() => coupons.filter((coupon) => coupon.active).length, [coupons]);

  const addCoupon = (event) => {
    event.preventDefault();
    if (!code.trim() || !value) return;

    setCoupons((prev) => [
      {
        id: `cp-${Date.now()}`,
        code: code.trim().toUpperCase(),
        type,
        value: Number(value),
        minOrder: Number(minOrder || 0),
        active: true,
      },
      ...prev,
    ]);

    setCode("");
    setType("percent");
    setValue("");
    setMinOrder("");
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Coupons</h2>
          <div className="breadcrumb">Home / <span>Coupons</span></div>
        </div>
      </div>

      <div className="coupon-layout">
        <section className="card">
          <div className="card-header">
            <span className="card-title">Create Coupon</span>
          </div>
          <form className="form-grid" onSubmit={addCoupon}>
            <div className="form-group">
              <label>Code *</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="WELCOME10" required />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="percent">Percent</option>
                <option value="flat">Flat</option>
              </select>
            </div>
            <div className="form-group">
              <label>Discount Value *</label>
              <input type="number" value={value} onChange={(e) => setValue(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Minimum Order</label>
              <input type="number" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
            </div>
            <div className="form-footer form-group full">
              <button className="btn btn-primary" type="submit"><MdAdd /> Add Coupon</button>
            </div>
          </form>
        </section>

        <section className="card coupon-summary-card">
          <div className="card-header">
            <span className="card-title">Summary</span>
          </div>
          <div className="banner-summary-list">
            <div><span>Total Coupons</span><strong>{coupons.length}</strong></div>
            <div><span>Active Coupons</span><strong>{active}</strong></div>
            <div><span>Inactive</span><strong>{coupons.length - active}</strong></div>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <span className="card-title">Coupons</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Minimum Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td className="font-medium">{coupon.code}</td>
                  <td>{coupon.type === "percent" ? `${coupon.value}%` : `₹${coupon.value}`}</td>
                  <td>₹{coupon.minOrder}</td>
                  <td>
                    <button
                      className={`btn btn-sm ${coupon.active ? "btn-success" : "btn-outline"}`}
                      onClick={() =>
                        setCoupons((prev) =>
                          prev.map((item) =>
                            item.id === coupon.id ? { ...item, active: !item.active } : item
                          )
                        )
                      }
                    >
                      {coupon.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm btn-icon"
                      onClick={() => setCoupons((prev) => prev.filter((item) => item.id !== coupon.id))}
                    >
                      <MdDelete />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
