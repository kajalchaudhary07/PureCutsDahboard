import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { MdArrowBack, MdOutlineCategory, MdClose } from "react-icons/md";
import {
  getAttributes, addAttribute, updateAttribute,
} from "../../firestoreService";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e",
  "#000000", "#ffffff", "#6b7280", "#d1d5db", "#92400e",
  "#7c3aed", "#0369a1", "#047857", "#b45309", "#9f1239",
];

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

const empty = {
  name: "",
  isColorField: false,
  values: [],
  searchable: true,
  sortable: true,
  status: "active",
};

export default function CreateAttribute() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(empty);
  const [colorInput, setColorInput] = useState("#3b82f6");
  const [textInput, setTextInput] = useState("");
  const [saving, setSaving] = useState(false);
  const colorRef = useRef();

  useEffect(() => {
    if (isEdit) {
      getAttributes().then((all) => {
        const found = all.find((a) => a.id === id);
        if (found) {
          setForm({
            ...empty,
            ...found,
            values: Array.isArray(found.values) ? found.values : [],
          });
        }
      }).catch(() => toast.error("Failed to load attribute"));
    }
  }, [id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addColorValue = () => {
    if (!form.values.includes(colorInput)) {
      set("values", [...form.values, colorInput]);
    } else {
      toast.warning("This color is already added");
    }
  };

  const addTextValue = () => {
    const v = textInput.trim();
    if (!v) return;
    if (form.values.includes(v)) {
      toast.warning("Value already added");
      return;
    }
    set("values", [...form.values, v]);
    setTextInput("");
  };

  const removeValue = (val) => set("values", form.values.filter((v) => v !== val));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Attribute name is required"); return; }
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        isColorField: form.isColorField,
        values: form.values,
        searchable: form.searchable,
        sortable: form.sortable,
        status: form.status || "active",
      };
      if (isEdit) {
        await updateAttribute(id, data);
        toast.success("Attribute updated!");
      } else {
        await addAttribute(data);
        toast.success("Attribute created!");
      }
      navigate("/attributes");
    } catch (err) {
      console.error("[CreateAttribute] Save failed:", err?.code, err?.message, err);
      const msg = err?.code === "permission-denied"
        ? "Permission denied — check Firestore rules for the 'attributes' collection"
        : err?.message || "Unknown error";
      toast.error(`Failed to save: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const rgb = hexToRgb(colorInput);

  return (
    <div className="page-content">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            className="btn btn-icon btn-outline"
            onClick={() => navigate("/attributes")}
          >
            <MdArrowBack />
          </button>
          <nav style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            <span>Dashboard</span>
            <span style={{ margin: "0 6px" }}>/</span>
            <span
              style={{ color: "var(--primary)", cursor: "pointer" }}
              onClick={() => navigate("/attributes")}
            >
              Attributes
            </span>
            <span style={{ margin: "0 6px" }}>/</span>
            <span>{isEdit ? "Edit Attribute" : "CreateAttribute"}</span>
          </nav>
        </div>
        <h1 className="page-title">{isEdit ? "Edit Attribute" : "createAttribute"}</h1>
      </div>

      <div className="create-attr-wrap">
        <form onSubmit={handleSave} className="create-attr-card">
          <div className="create-attr-header">
            <div className="create-attr-icon">
              <MdOutlineCategory />
            </div>
            <h2>Create New Attribute</h2>
          </div>

          {/* Attribute Name */}
          <div className="ca-field-row">
            <div className="ca-input-icon-wrap">
              <MdOutlineCategory className="ca-input-icon" />
              <input
                className="ca-input"
                placeholder="Attribute Name *"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
              <button
                type="button"
                className="ca-info-btn"
                title="Enter a unique attribute name like Colors, Sizes, Materials"
              >
                ⓘ
              </button>
            </div>
          </div>

          {/* Is Color Field */}
          <div className="ca-checkbox-row">
            <label className="ca-checkbox-label">
              <input
                type="checkbox"
                checked={form.isColorField}
                onChange={(e) => set("isColorField", e.target.checked)}
              />
              <span>Is this a Color Field?</span>
            </label>
            <button type="button" className="ca-info-btn" title="Enable to allow color swatch selection">
              ⓘ
            </button>
          </div>

          {/* Attribute Values */}
          <h4 className="ca-values-title">Attribute Values</h4>

          {form.isColorField ? (
            <div className="ca-color-picker-area">
              {/* Color gradient preview */}
              <div
                className="ca-color-gradient-box"
                style={{ background: colorInput }}
                onClick={() => colorRef.current?.click()}
              >
                <span className="ca-color-click-hint">Click to pick color</span>
              </div>
              <input
                ref={colorRef}
                type="color"
                value={colorInput}
                onChange={(e) => setColorInput(e.target.value)}
                className="ca-hidden-color-input"
              />

              {/* RGB display */}
              <div className="ca-rgb-display">
                <div className="ca-color-preview-circle" style={{ background: colorInput }} />
                <div className="ca-rgb-values">
                  <div className="ca-rgb-item"><span className="ca-rgb-label">R</span><span>{rgb.r}</span></div>
                  <div className="ca-rgb-item"><span className="ca-rgb-label">G</span><span>{rgb.g}</span></div>
                  <div className="ca-rgb-item"><span className="ca-rgb-label">B</span><span>{rgb.b}</span></div>
                  <div className="ca-rgb-item"><span className="ca-rgb-label">A</span><span>100%</span></div>
                </div>
              </div>

              {/* Preset swatches */}
              <div className="ca-preset-grid">
                {PRESET_COLORS.map((c) => (
                  <div
                    key={c}
                    className={`ca-preset-swatch ${colorInput === c ? "ca-preset-selected" : ""}`}
                    style={{ background: c }}
                    onClick={() => setColorInput(c)}
                    title={c}
                  />
                ))}
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 12, width: "100%" }}
                onClick={addColorValue}
              >
                + Add Color
              </button>

              {/* Added color swatches */}
              {form.values.length > 0 && (
                <div className="ca-added-colors">
                  {form.values.map((hex) => (
                    <div key={hex} className="ca-added-swatch-wrap" title={hex}>
                      <div className="ca-added-swatch" style={{ background: hex }} />
                      <button
                        type="button"
                        className="ca-swatch-remove"
                        onClick={() => removeValue(hex)}
                      >
                        <MdClose />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="ca-text-values-area">
              <div className="ca-input-icon-wrap">
                <textarea
                  className="ca-textarea"
                  placeholder="Enter values separated by commas, e.g. Small, Medium, Large, X Large"
                  value={form.values.join(", ")}
                  onChange={(e) => set("values", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))}
                  rows={4}
                />
                <button type="button" className="ca-info-btn" style={{ position: "absolute", top: 10, right: 10 }}>
                  ⓘ
                </button>
              </div>

              {/* Text value input row */}
              <div className="ca-text-add-row">
                <input
                  className="ca-input"
                  placeholder="Or type a value and press Add"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTextValue(); } }}
                />
                <button type="button" className="btn btn-outline" onClick={addTextValue}>Add</button>
              </div>

              {form.values.length > 0 && (
                <div className="ca-chips-row">
                  {form.values.map((val) => (
                    <span key={val} className="ca-chip">
                      {val}
                      <button type="button" onClick={() => removeValue(val)}><MdClose /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Searchable / Sortable */}
          <div className="ca-meta-row">
            <label className="ca-checkbox-label">
              <input
                type="checkbox"
                checked={form.searchable}
                onChange={(e) => set("searchable", e.target.checked)}
              />
              <span>Searchable</span>
            </label>
            <button type="button" className="ca-info-btn">ⓘ</button>

            <label className="ca-checkbox-label" style={{ marginLeft: 24 }}>
              <input
                type="checkbox"
                checked={form.sortable}
                onChange={(e) => set("sortable", e.target.checked)}
              />
              <span>Sortable</span>
            </label>
            <button type="button" className="ca-info-btn">ⓘ</button>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ width: "100%", marginTop: 8, padding: "12px" }}
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create"}
          </button>
        </form>
      </div>
    </div>
  );
}
