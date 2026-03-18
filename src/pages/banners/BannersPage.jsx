import { useMemo, useState } from "react";
import { MdAdd, MdDelete, MdImage } from "react-icons/md";

const INITIAL_BANNERS = [
  {
    id: "bn-1",
    title: "Summer Sale",
    image: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1200",
    link: "/products",
    active: true,
  },
  {
    id: "bn-2",
    title: "New Hair Care Range",
    image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200",
    link: "/categories",
    active: true,
  },
];

export default function BannersPage() {
  const [banners, setBanners] = useState(INITIAL_BANNERS);
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [link, setLink] = useState("/products");

  const activeCount = useMemo(() => banners.filter((banner) => banner.active).length, [banners]);

  const addBanner = (event) => {
    event.preventDefault();
    if (!title.trim() || !image.trim()) return;

    setBanners((prev) => [
      {
        id: `bn-${Date.now()}`,
        title: title.trim(),
        image: image.trim(),
        link: link.trim() || "/products",
        active: true,
      },
      ...prev,
    ]);

    setTitle("");
    setImage("");
    setLink("/products");
  };

  const removeBanner = (id) => setBanners((prev) => prev.filter((banner) => banner.id !== id));

  const toggleBanner = (id) => {
    setBanners((prev) =>
      prev.map((banner) =>
        banner.id === id ? { ...banner, active: !banner.active } : banner
      )
    );
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Banners</h2>
          <div className="breadcrumb">Home / <span>Banners</span></div>
        </div>
      </div>

      <div className="banner-layout">
        <section className="card">
          <div className="card-header">
            <span className="card-title">Create Banner</span>
          </div>
          <form className="form-grid single" onSubmit={addBanner}>
            <div className="form-group">
              <label>Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Festival offer" required />
            </div>
            <div className="form-group">
              <label>Image URL *</label>
              <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." required />
            </div>
            <div className="form-group">
              <label>Redirect Link</label>
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/products" />
            </div>
            <div className="form-footer">
              <button className="btn btn-primary" type="submit"><MdAdd /> Add Banner</button>
            </div>
          </form>
        </section>

        <section className="card banner-summary-card">
          <div className="card-header">
            <span className="card-title">Summary</span>
          </div>
          <div className="banner-summary-list">
            <div><span>Total Banners</span><strong>{banners.length}</strong></div>
            <div><span>Active Banners</span><strong>{activeCount}</strong></div>
            <div><span>Inactive</span><strong>{banners.length - activeCount}</strong></div>
          </div>
        </section>
      </div>

      <section className="banner-grid">
        {banners.length === 0 ? (
          <div className="card empty-state"><p>No banners yet.</p></div>
        ) : (
          banners.map((banner) => (
            <article key={banner.id} className="card banner-card">
              {banner.image ? (
                <img src={banner.image} alt={banner.title} className="banner-image" />
              ) : (
                <div className="banner-image-fallback"><MdImage /></div>
              )}
              <div className="banner-body">
                <div>
                  <h4>{banner.title}</h4>
                  <p>{banner.link}</p>
                </div>
                <div className="banner-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => toggleBanner(banner.id)}>
                    {banner.active ? "Disable" : "Enable"}
                  </button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeBanner(banner.id)}>
                    <MdDelete />
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}
