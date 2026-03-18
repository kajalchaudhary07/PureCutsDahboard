import { useState } from "react";
import { MdCloudUpload, MdDelete, MdImage } from "react-icons/md";

const MEDIA_TYPES = ["None", "Banners", "Brands", "Categories", "Products", "Personalized"];

export default function MediaPage() {
  const [files, setFiles] = useState([]);
  const [selectedType, setSelectedType] = useState("None");

  const onPick = (event) => {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;

    const mapped = selected.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      preview: URL.createObjectURL(file),
      type: selectedType,
    }));

    setFiles((prev) => [...mapped, ...prev]);
    event.target.value = "";
  };

  const visibleFiles =
    selectedType === "None"
      ? files
      : files.filter((file) => String(file.type || "None") === selectedType);

  const removeMedia = (id) => {
    setFiles((prev) => {
      const target = prev.find((file) => file.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((file) => file.id !== id);
    });
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Media</h2>
          <div className="breadcrumb">Home / <span>Media</span></div>
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <span className="card-title">Upload Media</span>
        </div>
        <div className="media-toolbar">
          <div className="form-group media-select-wrap">
            <label>Media Type</label>
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
              {MEDIA_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="media-upload-box">
          <MdCloudUpload />
          <p>
            Drop images here or click to select files
            {selectedType !== "None" ? ` for ${selectedType}` : ""}
          </p>
          <input type="file" accept="image/*" multiple onChange={onPick} />
        </label>
      </section>

      <section className="media-grid">
        {visibleFiles.length === 0 ? (
          <div className="card empty-state">
            <MdImage />
            <p>
              {files.length === 0
                ? "No media uploaded yet."
                : `No media found for ${selectedType}.`}
            </p>
          </div>
        ) : (
          visibleFiles.map((file) => (
            <article key={file.id} className="card media-card">
              <img src={file.preview} alt={file.name} className="media-thumb" />
              <div className="media-meta">
                <strong title={file.name}>{file.name}</strong>
                <span>{file.size}</span>
                <span className="badge badge-gray">{file.type || "None"}</span>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => removeMedia(file.id)}>
                <MdDelete /> Remove
              </button>
            </article>
          ))
        )}
      </section>
    </>
  );
}
