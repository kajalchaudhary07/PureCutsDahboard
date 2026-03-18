import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { MdAdd, MdDelete, MdImage, MdVideocam } from "react-icons/md";
import {
  addBanner,
  deleteBanner,
  getBanners,
  toggleBannerStatus,
} from "../../firestoreService";

const friendlyError = (e, fallback) => {
  const code = String(e?.code || "").toLowerCase();
  if (code.includes("permission-denied")) {
    return "Permission denied. Your account needs admin access to manage banners.";
  }
  if (code.includes("unauthenticated")) {
    return "Please sign in again to continue.";
  }
  return e?.message || fallback;
};

const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm|ogv|m3u8)(\?|#|$)/i;

const isVideoBanner = (banner = {}) => {
  const explicit = String(banner.mediaType || "").trim().toLowerCase();
  if (explicit === "video") return true;
  if (explicit === "image") return false;
  const raw = String(banner.mediaUrl || banner.image || "").trim().toLowerCase();
  return raw.startsWith("data:video/") || VIDEO_EXT_RE.test(raw);
};

export default function BannersPage() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");

  const activeCount = useMemo(() => banners.filter((banner) => banner.active).length, [banners]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getBanners();
      setBanners(data);
    } catch (e) {
      toast.error(friendlyError(e, "Failed to load banners"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onAddBanner = async (event) => {
    event.preventDefault();
    if (!title.trim() || !mediaUrl.trim()) {
      toast.error("Title and media URL are required");
      return;
    }

    setSaving(true);
    try {
      await addBanner({
        title: title.trim(),
        mediaUrl: mediaUrl.trim(),
        link: "/products",
        active: true,
      });
      setTitle("");
      setMediaUrl("");
      await load();
      toast.success("Banner added");
    } catch (e) {
      toast.error(friendlyError(e, "Failed to add banner"));
    } finally {
      setSaving(false);
    }
  };

  const onRemoveBanner = async (id) => {
    try {
      await deleteBanner(id);
      setBanners((prev) => prev.filter((banner) => banner.id !== id));
      toast.success("Banner removed");
    } catch (e) {
      toast.error(friendlyError(e, "Failed to remove banner"));
    }
  };

  const onToggleBanner = async (id, active) => {
    try {
      await toggleBannerStatus(id, active);
      setBanners((prev) =>
        prev.map((banner) =>
          banner.id === id ? { ...banner, active: !banner.active } : banner
        )
      );
    } catch (e) {
      toast.error(friendlyError(e, "Failed to update banner status"));
    }
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
          <form className="form-grid single" onSubmit={onAddBanner}>
            <div className="form-group">
              <label>Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Festival offer" required />
            </div>
            <div className="form-group">
              <label>Media URL (Image or Video) *</label>
              <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://..." required />
            </div>
            <div className="form-footer">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                <MdAdd /> {saving ? "Adding..." : "Add Banner"}
              </button>
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
        {loading ? (
          <div className="card empty-state"><p>Loading banners...</p></div>
        ) : banners.length === 0 ? (
          <div className="card empty-state"><p>No banners yet.</p></div>
        ) : (
          banners.map((banner) => (
            <article key={banner.id} className="card banner-card">
              {(banner.mediaUrl || banner.image) ? (
                isVideoBanner(banner) ? (
                  <video
                    src={banner.mediaUrl || banner.image}
                    className="banner-image"
                    muted
                    loop
                    autoPlay
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img src={banner.mediaUrl || banner.image} alt={banner.title} className="banner-image" />
                )
              ) : (
                <div className="banner-image-fallback">
                  {isVideoBanner(banner) ? <MdVideocam /> : <MdImage />}
                </div>
              )}
              <div className="banner-body">
                <div>
                  <h4>{banner.title}</h4>
                  <p>{isVideoBanner(banner) ? "Video Banner" : "Image Banner"}</p>
                  <p>{banner.link}</p>
                </div>
                <div className="banner-actions">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => onToggleBanner(banner.id, banner.active)}
                  >
                    {banner.active ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm btn-icon"
                    onClick={() => onRemoveBanner(banner.id)}
                  >
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
