import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  MdAdd,
  MdEdit,
  MdDelete,
  MdSearch,
  MdImage,
  MdSort,
  MdOutlineVisibility,
  MdOutlineVisibilityOff,
} from "react-icons/md";
import { getProductsPaginated, deleteProduct, updateProduct, deleteProductsBulk } from "../../firestoreService";
import ConfirmDialog from "../../components/ConfirmDialog";

const CATEGORIES = ["All", "Hair Care", "Color", "Tools", "Skin Care", "Nail", "Beard", "Wax", "Furnitures"];

const normalizeCategoryName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]+/g, "");

const isFurnitureCategoryName = (value) => {
  const normalized = normalizeCategoryName(value);
  return (
    normalized === "furniture" ||
    normalized === "furnitures" ||
    normalized.startsWith("furniture")
  );
};

const isFurnitureProduct = (product = {}) => {
  const selected = Array.isArray(product.selectedCategories) ? product.selectedCategories : [];
  return selected.some(isFurnitureCategoryName) || isFurnitureCategoryName(product.category);
};

const firstNonEmptyText = (...values) => {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
};

const toMillisSafe = (value) => {
  if (!value) return 0;
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return Number.isFinite(date?.getTime?.()) ? date.getTime() : 0;
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getTime() : 0;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveProductThumb = (product = {}) => {
  const raw = firstNonEmptyText(
    product.thumbnailUrl,
    product.thumbnail,
    product.thumb,
    product.image,
    product.imageUrl,
    Array.isArray(product.images) ? product.images[0] : "",
    Array.isArray(product.additionalImages) ? product.additionalImages[0] : ""
  );

  if (!raw) return "";

  const stamp =
    toMillisSafe(product.updatedAt) ||
    toMillisSafe(product.imageContractUpdatedAt) ||
    toMillisSafe(product.createdAt);

  if (!stamp) return raw;
  return raw.includes("?") ? `${raw}&v=${stamp}` : `${raw}?v=${stamp}`;
};

export default function ProductsList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchHydrating, setSearchHydrating] = useState(false);
  const [catalogFullyLoaded, setCatalogFullyLoaded] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [subCatFilter, setSubCatFilter] = useState("All");
  const [subSubCatFilter, setSubSubCatFilter] = useState("All");
  const [sortBy, setSortBy] = useState("name_asc");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const navigate = useNavigate();

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const visibleIds = filtered.map((p) => p.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => {
        const next = [...prev];
        visibleIds.forEach((id) => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  // Clear selection when filters or search change
  useEffect(() => {
    setSelectedIds([]);
  }, [catFilter, subCatFilter, subSubCatFilter, search]);

  const handleBulkPublish = async () => {
    setBulkUpdating(true);
    try {
      await Promise.all(selectedIds.map((id) => updateProduct(id, { visibility: "publish" })));
      setProducts((prev) =>
        prev.map((p) =>
          selectedIds.includes(p.id) ? { ...p, visibility: "publish" } : p
        )
      );
      toast.success(`${selectedIds.length} product(s) set to Published`);
      setSelectedIds([]);
    } catch {
      toast.error("Failed to update some products visibility");
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkDraft = async () => {
    setBulkUpdating(true);
    try {
      await Promise.all(selectedIds.map((id) => updateProduct(id, { visibility: "draft" })));
      setProducts((prev) =>
        prev.map((p) =>
          selectedIds.includes(p.id) ? { ...p, visibility: "draft" } : p
        )
      );
      toast.success(`${selectedIds.length} product(s) set to Draft`);
      setSelectedIds([]);
    } catch {
      toast.error("Failed to update some products visibility");
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    setShowBulkDeleteConfirm(false);
    setBulkUpdating(true);
    try {
      await deleteProductsBulk(selectedIds);
      toast.success(`${selectedIds.length} product(s) deleted`);
      setSelectedIds([]);
      load({ append: false });
    } catch {
      toast.error("Bulk delete failed");
    } finally {
      setBulkUpdating(false);
    }
  };

  const load = async ({ append = false } = {}) => {
    if (append) {
      if (!hasMore || loadingMore) return;
      setLoadingMore(true);
    } else {
      setLoading(true);
      setSelectedIds([]);
    }

    try {
      const page = await getProductsPaginated({
        pageSize: 30,
        cursor: append ? nextCursor : null,
      });
      setProducts((prev) => (append ? [...prev, ...page.rows] : page.rows));
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      if (!append) {
        setCatalogFullyLoaded(!page.hasMore);
      }
    } catch (e) {
      toast.error("Failed to load products");
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    setSubCatFilter("All");
    setSubSubCatFilter("All");
  }, [catFilter]);

  useEffect(() => {
    setSubSubCatFilter("All");
  }, [subCatFilter]);

  const normalizeSearchText = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const getCreatedAtMs = (row) => {
    const raw = row?.createdAt ?? row?.updatedAt ?? null;
    if (!raw) return 0;
    if (typeof raw?.toDate === "function") {
      const d = raw.toDate();
      return Number.isFinite(d?.getTime?.()) ? d.getTime() : 0;
    }
    if (raw instanceof Date) {
      return Number.isFinite(raw.getTime()) ? raw.getTime() : 0;
    }
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d.getTime() : 0;
  };

  const hydrateCatalogForSearch = async () => {
    if (catalogFullyLoaded || !hasMore || searchHydrating || loadingMore) return;

    setSearchHydrating(true);
    try {
      let cursor = nextCursor;
      let more = hasMore;
      let safety = 0;
      let allRows = [...products];

      while (more && cursor && safety < 120) {
        safety += 1;
        const page = await getProductsPaginated({ pageSize: 100, cursor });
        allRows = [...allRows, ...page.rows];
        cursor = page.nextCursor;
        more = page.hasMore;
      }

      const deduped = Array.from(
        new Map(allRows.map((row) => [row.id, row])).values()
      );

      setProducts(deduped);
      setNextCursor(cursor);
      setHasMore(more);
      setCatalogFullyLoaded(!more);
    } catch {
      toast.error("Could not load full catalog for search.");
    } finally {
      setSearchHydrating(false);
    }
  };

  useEffect(() => {
    const q = search.trim();
    if (!q) return;
    hydrateCatalogForSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const sortedUnique = (values = []) => {
    return Array.from(
      new Set(
        values
          .map((v) => String(v || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  };

  const availableSubCategories = useMemo(() => {
    const inCategory = products.filter(
      (p) => catFilter === "All" || String(p.category || "").trim() === catFilter
    );
    return ["All", ...sortedUnique(inCategory.map((p) => p.subCategory || p.subcategory || p.sub_category))];
  }, [catFilter, products]);

  const availableSubSubCategories = useMemo(() => {
    const inScope = products.filter((p) => {
      const matchCat = catFilter === "All" || String(p.category || "").trim() === catFilter;
      const currentSub = String(p.subCategory || p.subcategory || p.sub_category || "").trim();
      const matchSub = subCatFilter === "All" || currentSub === subCatFilter;
      return matchCat && matchSub;
    });

    return [
      "All",
      ...sortedUnique(
        inScope.map((p) => p.subSubCategory || p.subsubCategory || p.sub_sub_category)
      ),
    ];
  }, [catFilter, subCatFilter, products]);

  const filtered = useMemo(() => {
    const q = normalizeSearchText(search);

    const rows = products.filter((p) => {
      const category = String(p.category || "").trim();
      const subCategory = String(
        p.subCategory || p.subcategory || p.sub_category || ""
      ).trim();
      const subSubCategory = String(
        p.subSubCategory || p.subsubCategory || p.sub_sub_category || ""
      ).trim();

      const matchCat = catFilter === "All" || category === catFilter;
      const matchSub = subCatFilter === "All" || subCategory === subCatFilter;
      const matchSubSub =
        subSubCatFilter === "All" || subSubCategory === subSubCatFilter;

      const haystack = normalizeSearchText(
        [
          p.name,
          p.brand,
          p.tag,
          p.category,
          p.subCategory,
          p.subSubCategory,
          p.size,
          p.productType,
          p.sku,
        ]
          .filter(Boolean)
          .join(" ")
      );

      const matchSearch = !q || haystack.includes(q);
      return matchCat && matchSub && matchSubSub && matchSearch;
    });

    rows.sort((a, b) => {
      if (sortBy === "name_desc") {
        return String(b.name || "").localeCompare(String(a.name || ""), undefined, {
          sensitivity: "base",
        });
      }
      if (sortBy === "oldest") {
        return getCreatedAtMs(a) - getCreatedAtMs(b);
      }
      if (sortBy === "newest") {
        return getCreatedAtMs(b) - getCreatedAtMs(a);
      }
      // Default: name_asc (A → Z)
      return String(a.name || "").localeCompare(String(b.name || ""), undefined, {
        sensitivity: "base",
      });
    });

    return rows;
  }, [catFilter, products, search, sortBy, subCatFilter, subSubCatFilter]);

  const handleDelete = async () => {
    try {
      await deleteProduct(deleteTarget);
      toast.success("Product deleted");
      setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget));
      setDeleteTarget(null);
      load({ append: false });
    } catch {
      toast.error("Delete failed");
    }
  };


  const normalizeVisibility = (product) => {
    const raw = String(product.visibility || "publish").trim().toLowerCase();
    return raw === "draft" ? "draft" : "publish";
  };

  const setVisibility = async (product, nextVisibility) => {
    const current = normalizeVisibility(product);
    if (current === nextVisibility) return;

    try {
      await updateProduct(product.id, { visibility: nextVisibility });
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, visibility: nextVisibility } : p
        )
      );
      toast.success(
        `${product.name || "Product"} set to ${nextVisibility === "publish" ? "Published" : "Draft"}`
      );
    } catch {
      toast.error("Failed to update product visibility");
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

      {showBulkDeleteConfirm && (
        <ConfirmDialog
          title="Delete Selected Products?"
          message={`Are you sure you want to permanently delete the ${selectedIds.length} selected product(s)?`}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDeleteConfirm(false)}
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

        <select
          value={subCatFilter}
          onChange={(e) => setSubCatFilter(e.target.value)}
          style={{ height: 36, minWidth: 170 }}
          title="Filter by sub-category"
        >
          {availableSubCategories.map((name) => (
            <option key={name} value={name}>
              {name === "All" ? "All Sub Categories" : name}
            </option>
          ))}
        </select>

        <select
          value={subSubCatFilter}
          onChange={(e) => setSubSubCatFilter(e.target.value)}
          style={{ height: 36, minWidth: 180 }}
          title="Filter by sub-sub-category"
        >
          {availableSubSubCategories.map((name) => (
            <option key={name} value={name}>
              {name === "All" ? "All Sub Sub Categories" : name}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <MdSort style={{ color: "#64748b" }} />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ height: 36, minWidth: 190 }}
            title="Sort products"
          >
            <option value="name_asc">Sort: Name (A → Z)</option>
            <option value="name_desc">Sort: Name (Z → A)</option>
            <option value="oldest">Sort: Oldest → Newest</option>
            <option value="newest">Sort: Newest → Oldest</option>
          </select>
        </div>

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
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span className="card-title">
            Products ({filtered.length}) {selectedIds.length > 0 && `(${selectedIds.length} selected)`}
            {searchHydrating ? " • Expanding search..." : ""}
          </span>
          {selectedIds.length > 0 && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                className="btn btn-outline btn-sm"
                style={{ display: "flex", alignItems: "center", gap: 4 }}
                onClick={handleBulkPublish}
                disabled={bulkUpdating}
              >
                <MdOutlineVisibility /> Set Published
              </button>
              <button
                className="btn btn-outline btn-sm"
                style={{ display: "flex", alignItems: "center", gap: 4 }}
                onClick={handleBulkDraft}
                disabled={bulkUpdating}
              >
                <MdOutlineVisibilityOff /> Set Draft
              </button>
              <button
                className="btn btn-danger btn-sm"
                style={{ display: "flex", alignItems: "center", gap: 4 }}
                onClick={() => setShowBulkDeleteConfirm(true)}
                disabled={bulkUpdating}
              >
                <MdDelete /> Delete Selected
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setSelectedIds([])}
                disabled={bulkUpdating}
              >
                Clear Selection
              </button>
            </div>
          )}
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
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every((p) => selectedIds.includes(p.id))}
                      onChange={toggleSelectAll}
                      style={{ cursor: "pointer", width: 16, height: 16 }}
                    />
                  </th>
                  <th>#</th>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Brand</th>
                  <th>Category</th>
                  <th>Price (₹)</th>
                  <th>MRP (₹)</th>
                  <th>Tag</th>
                  <th>Status</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr
                    key={p.id}
                    className={selectedIds.includes(p.id) ? "selected-row" : ""}
                    onClick={() => toggleSelect(p.id)}
                    style={{ cursor: "pointer" }}
                  >
                    {(() => {
                      const visibility = normalizeVisibility(p);
                      const isPublished = visibility === "publish";
                      return (
                        <>
                    <td onClick={(e) => { e.stopPropagation(); toggleSelect(p.id); }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.id)}
                        readOnly
                        style={{ cursor: "pointer", width: 16, height: 16 }}
                      />
                    </td>
                    <td className="text-muted" onClick={(e) => { e.stopPropagation(); toggleSelect(p.id); }}>
                      {i + 1}
                    </td>
                    <td>
                      {resolveProductThumb(p) ? (
                        <img src={resolveProductThumb(p)} alt={p.name} className="table-img" />
                      ) : (
                        <div className="no-img"><MdImage /></div>
                      )}
                    </td>
                    <td>
                      {isFurnitureProduct(p) && p.contactNumber ? (
                        <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>
                          Contact: {String(p.contactNumber).replace(/\D+/g, "").slice(0, 10)}
                        </div>
                      ) : null}
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
                      <span
                        className={`badge ${
                          isPublished ? "badge-green" : "badge-blue"
                        }`}
                      >
                        {isPublished ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${p.stock === 0 || p.stock === "0" || p.stockStatus === "out_of_stock" ? "badge-red" : "badge-green"}`}>
                        {p.stock === 0 || p.stock === "0" || p.stockStatus === "out_of_stock" ? "Out of Stock" : "In Stock"}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button
                          className={`btn btn-sm btn-icon ${
                            isPublished ? "btn-outline" : "btn-primary"
                          }`}
                          title="Set Published"
                          onClick={() => setVisibility(p, "publish")}
                        >
                          <MdOutlineVisibility />
                        </button>
                        <button
                          className={`btn btn-sm btn-icon ${
                            !isPublished ? "btn-outline" : "btn-secondary"
                          }`}
                          title="Set Draft"
                          onClick={() => setVisibility(p, "draft")}
                        >
                          <MdOutlineVisibilityOff />
                        </button>
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
                        </>
                      );
                    })()}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 ? (
        <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
          {hasMore ? (
            <button
              className="btn btn-outline"
              onClick={() => load({ append: true })}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading..." : "Load more products"}
            </button>
          ) : (
            <span className="text-muted" style={{ fontSize: 12 }}>
              End of products list
            </span>
          )}
        </div>
      ) : null}
    </>
  );
}
