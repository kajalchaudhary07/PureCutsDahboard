import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { MdAdd, MdDelete, MdImage, MdVideocam } from "react-icons/md";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebaseConfig";
import {
  addBanner,
  deleteBanner,
  getBanners,
  toggleBannerStatus,
} from "../../firestoreService";
import { useClipboardFilePaste } from "../../utils/useClipboardFilePaste";

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
  const [mediaType, setMediaType] = useState("image");
  const [mediaUrl, setMediaUrl] = useState("");
  const [link, setLink] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState("");
  const mediaInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (mediaPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(mediaPreview);
      }
    };
  }, [mediaPreview]);

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

  const handleMediaFileChange = (event) => {
    const picked = event.target.files?.[0];
    if (!picked) return;

    if (!picked.type.startsWith("image/") && !picked.type.startsWith("video/")) {
      toast.error("Please choose an image or video file");
      event.target.value = "";
      return;
    }

    if (mediaPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(mediaPreview);
    }

    setMediaFile(picked);
    setMediaType(picked.type.startsWith("video/") ? "video" : "image");
    setMediaUrl("");
    setMediaPreview(URL.createObjectURL(picked));
  };

  useClipboardFilePaste({
    enabled: true,
    allowVideo: true,
    onFiles: (files) => {
      const picked = files?.[0];
      if (!picked) return;

      if (mediaPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(mediaPreview);
      }

      setMediaFile(picked);
      setMediaType(picked.type.startsWith("video/") ? "video" : "image");
      setMediaUrl("");
      setMediaPreview(URL.createObjectURL(picked));
      toast.success("Banner media pasted from clipboard");
    },
  });

  const uploadBannerMedia = async () => {
    if (!mediaFile) return mediaUrl.trim();
    const safeName = String(mediaFile.name || "banner_media")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "");

    const storageRef = ref(storage, `banners/${Date.now()}_${safeName}`);
    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, mediaFile);
      task.on(
        "state_changed",
        null,
        reject,
        () => getDownloadURL(task.snapshot.ref).then(resolve).catch(reject)
      );
    });
  };

  const onAddBanner = async (event) => {
    event.preventDefault();
    if (!title.trim() || !link.trim()) {
      toast.error("Title and link are required");
      return;
    }
    if (!mediaFile && !mediaUrl.trim()) {
      toast.error("Please upload media from your system or provide media URL");
      return;
    }

    setSaving(true);
    try {
      const uploadedMediaUrl = await uploadBannerMedia();
      await addBanner({
        title: title.trim(),
        mediaType,
        mediaUrl: uploadedMediaUrl,
        link: link.trim(),
        active: true,
      });
      setTitle("");
      setMediaType("image");
      setMediaUrl("");
      setLink("");
      setMediaFile(null);
      if (mediaPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(mediaPreview);
      }
      setMediaPreview("");
      if (mediaInputRef.current) mediaInputRef.current.value = "";
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
              <label>Media Type *</label>
              <select value={mediaType} onChange={(e) => setMediaType(e.target.value)} required>
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </div>
            <div className="form-group">
              <label>Upload Media from System *</label>
              <div className="img-upload" onClick={() => mediaInputRef.current?.click()}>
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleMediaFileChange}
                />
                {mediaPreview ? (
                  mediaType === "video" ? (
                    <video src={mediaPreview} className="img-preview" muted playsInline />
                  ) : (
                    <img src={mediaPreview} className="img-preview" alt="preview" />
                  )
                ) : mediaType === "video" ? (
                  <MdVideocam style={{ fontSize: 36, color: "var(--text-secondary)" }} />
                ) : (
                  <MdImage style={{ fontSize: 36, color: "var(--text-secondary)" }} />
                )}
                <div className="img-upload-label"><span>Choose file from device</span></div>
                <div className="img-upload-hint">Tip: Press Ctrl+V to paste copied image or video</div>
              </div>
              <input
                value={!mediaFile ? mediaUrl : ""}
                onChange={(e) => {
                  setMediaFile(null);
                  if (mediaPreview?.startsWith("blob:")) {
                    URL.revokeObjectURL(mediaPreview);
                  }
                  setMediaPreview("");
                  setMediaUrl(e.target.value);
                }}
                placeholder="Or paste media URL (optional)"
                style={{ marginTop: 8 }}
              />
            </div>
            <div className="form-group">
              <label>Banner Link *</label>
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="/products or https://example.com/page"
                required
              />
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
                  {banner.link ? (
                    <p>
                      <a href={banner.link} target="_blank" rel="noreferrer">
                        {banner.link}
                      </a>
                    </p>
                  ) : null}
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
