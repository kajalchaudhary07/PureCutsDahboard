import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  getBulkLeads,
  getSupportBotConfig,
  saveSupportBotConfig,
} from "../../firestoreService";

export default function SupportBotPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [botConfig, setBotConfig] = useState({
    enabled: true,
    steps: {
      START: {
        text: "Welcome to PureCuts Bulk Support 👋",
        options: ["Bulk Order Discount", "Product Availability", "Delivery Info"],
      },
      CATEGORY: {
        text: "Select product type:",
        options: ["Skincare", "Hair", "Equipment", "Mixed"],
      },
      QUANTITY: {
        text: "Select quantity range:",
        options: ["5-10", "10-25", "25-50", "50+"],
      },
    },
    discounts: {
      "5-10": "5%",
      "10-25": "8%",
      "25-50": "12%",
      "50+": "15%",
    },
  });
  const [bulkLeads, setBulkLeads] = useState([]);
  const [stepOptionDrafts, setStepOptionDrafts] = useState({});

  const buildOptionDrafts = (steps = {}) =>
    Object.fromEntries(
      Object.entries(steps).map(([stepKey, stepValue]) => [
        stepKey,
        (stepValue?.options || []).join(", "),
      ])
    );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [cfg, leads] = await Promise.all([getSupportBotConfig(), getBulkLeads()]);
        if (cancelled) return;
        setBotConfig(cfg);
        setBulkLeads(leads);
        setStepOptionDrafts(buildOptionDrafts(cfg.steps));
      } catch (err) {
        if (!cancelled) {
          toast.error(err?.message || "Could not load support bot config.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateStepText = (step, text) => {
    setBotConfig((prev) => ({
      ...prev,
      steps: {
        ...prev.steps,
        [step]: {
          ...prev.steps[step],
          text,
        },
      },
    }));
  };

  const updateStepOptionsDraft = (step, csv) => {
    setStepOptionDrafts((prev) => ({
      ...prev,
      [step]: csv,
    }));
  };

  const normalizeConfigForSave = () => {
    const nextSteps = Object.fromEntries(
      Object.entries(botConfig.steps || {}).map(([stepKey, stepValue]) => {
        const raw = String(
          stepOptionDrafts[stepKey] ?? (stepValue?.options || []).join(", ")
        );
        const options = raw
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

        return [
          stepKey,
          {
            ...stepValue,
            options,
          },
        ];
      })
    );

    return {
      ...botConfig,
      steps: nextSteps,
    };
  };

  const updateDiscount = (range, value) => {
    setBotConfig((prev) => ({
      ...prev,
      discounts: {
        ...prev.discounts,
        [range]: value,
      },
    }));
  };

  const saveBot = async () => {
    setSaving(true);
    try {
      const normalized = normalizeConfigForSave();
      await saveSupportBotConfig(normalized);
      setBotConfig(normalized);
      setStepOptionDrafts(buildOptionDrafts(normalized.steps));
      toast.success("Support bot config saved.");
    } catch (err) {
      toast.error(err?.message || "Could not save support bot config.");
    } finally {
      setSaving(false);
    }
  };

  const discountRows = useMemo(
    () => Object.entries(botConfig.discounts || {}),
    [botConfig.discounts]
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Support Bot Config</h2>
          <div className="breadcrumb">Home / <span>Support Bot</span></div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={saveBot}
          disabled={loading || saving}
        >
          {saving ? "Saving..." : "Save Bot Config"}
        </button>
      </div>

      <section className="card">
        <div className="card-header">
          <span className="card-title">Bot Controls</span>
        </div>

        <div className="settings-list">
          <label className="settings-row">
            <div>
              <strong>Enable Support Bot</strong>
              <p>When disabled, automation pauses and admin can take over manually.</p>
            </div>
            <input
              type="checkbox"
              checked={Boolean(botConfig.enabled)}
              onChange={(e) =>
                setBotConfig((prev) => ({ ...prev, enabled: e.target.checked }))
              }
              disabled={loading}
            />
          </label>
        </div>

        <div className="form-grid single">
          {Object.entries(botConfig.steps || {}).map(([stepKey, stepValue]) => (
            <div className="form-group" key={stepKey}>
              <label>{stepKey} Message</label>
              <textarea
                value={stepValue?.text || ""}
                onChange={(e) => updateStepText(stepKey, e.target.value)}
                placeholder={`Enter ${stepKey} message`}
                disabled={loading}
              />
              <label>{stepKey} Options (comma separated)</label>
              <input
                value={
                  stepOptionDrafts[stepKey] ?? (stepValue?.options || []).join(", ")
                }
                onChange={(e) => updateStepOptionsDraft(stepKey, e.target.value)}
                placeholder="Option A, Option B, Option C"
                disabled={loading}
              />
            </div>
          ))}

          <div className="form-group">
            <label>Discount Slabs</label>
            <div className="notify-channel-grid">
              {discountRows.map(([range, value]) => (
                <div key={range} className="form-group">
                  <label>{range}</label>
                  <input
                    value={value}
                    onChange={(e) => updateDiscount(range, e.target.value)}
                    placeholder="e.g. 10%"
                    disabled={loading}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <div className="card-header">
          <span className="card-title">Recent Bulk Leads</span>
        </div>
        <div className="form-grid single">
          <div className="selected-order-card">
            <div className="font-medium">Total leads</div>
            <div className="text-muted">{bulkLeads.length} captured from support bot flow.</div>
            {bulkLeads.slice(0, 8).map((lead) => (
              <div key={lead.id} className="settings-row" style={{ marginTop: 8 }}>
                <div>
                  <strong>{lead.category || "Category N/A"}</strong>
                  <p>
                    Qty {lead.quantity || "-"} • Discount {lead.discount || "-"}
                  </p>
                </div>
                <span className="badge badge-blue">{lead.userId || "user"}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
