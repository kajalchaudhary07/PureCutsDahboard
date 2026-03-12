import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  MdAdd, MdEdit, MdDelete, MdSearch, MdImage,
} from "react-icons/md";
import { getProducts, deleteProduct } from "../../firestoreService";
import ConfirmDialog from "../../components/ConfirmDialog";

const CATEGORIES = ["All", "Hair Care", "Color", "Tools", "Skin Care", "Nail", "Beard", "Wax"];

export default function ProductsList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (e) {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = products.filter((p) => {
    const matchCat = catFilter === "All" || p.category === catFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.name?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const handleDelete = async () => {
    try {
      await deleteProduct(deleteTarget);
      toast.success("Product deleted");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <>
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Product?"
          message="This product will be permanently removed."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="page-header">
        <div>
          <h2>All Products</h2>
          <div className="breadcrumb">
            Home / <span>Products</span>
          </div>
        </div>
        <Link to="/products/add" className="btn btn-primary">
          <MdAdd /> Add Product
        </Link>
      </div>

      {/* Category filter tabs */}
      <div className="filter-row">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`filter-tab ${catFilter === c ? "active" : ""}`}
            onClick={() => setCatFilter(c)}
          >
            {c}
          </button>
        ))}

        <div className="search-wrap" style={{ marginLeft: "auto" }}>
          <MdSearch />
          <input
            className="search-input"
            placeholder="Search product or brand…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Products ({filtered.length})</span>
        </div>

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <MdImage />
            <p>No products found.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Brand</th>
                  <th>Category</th>
                  <th>Price (₹)</th>
                  <th>MRP (₹)</th>
                  <th>Tag</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id}>
                    <td className="text-muted">{i + 1}</td>
                    <td>
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="table-img" />
                      ) : (
                        <div className="no-img"><MdImage /></div>
                      )}
                    </td>
                    <td>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>{p.size}</div>
                    </td>
                    <td>{p.brand || "—"}</td>
                    <td>
                      <span className="badge badge-blue">{p.category || "—"}</span>
                    </td>
                    <td>₹{p.price}</td>
                    <td className="text-muted" style={{ textDecoration: "line-through" }}>
                      ₹{p.originalPrice}
                    </td>
                    <td>
                      {p.tag ? (
                        <span className="badge badge-orange">{p.tag}</span>
                      ) : "—"}
                    </td>
                    <td>
                      <span className={`badge ${p.stock > 0 || p.stock === undefined ? "badge-green" : "badge-red"}`}>
                        {p.stock !== undefined ? (p.stock > 0 ? "In Stock" : "Out") : "In Stock"}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-warning btn-sm btn-icon"
                          title="Edit"
                          onClick={() => navigate(`/products/edit/${p.id}`)}
                        >
                          <MdEdit />
                        </button>
                        <button
                          className="btn btn-danger btn-sm btn-icon"
                          title="Delete"
                          onClick={() => setDeleteTarget(p.id)}
                        >
                          <MdDelete />
                        </button>
                      </div>
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
