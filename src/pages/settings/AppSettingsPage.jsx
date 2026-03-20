import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  getBulkLeads,
  getSupportBotConfig,
  saveSupportBotConfig,
} from "../../firestoreService";

export default function AppSettingsPage() {
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    allowCod: true,
    autoApproveReviews: false,
    enableWhatsapp: true,
    defaultCurrency: "INR",
    taxPercent: 18,
  });

  const update = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

  const [botLoading, setBotLoading] = useState(true);
  const [botSaving, setBotSaving] = useState(false);
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
      setBotLoading(true);
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
        if (!cancelled) setBotLoading(false);
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
    setBotSaving(true);
    try {
      const normalized = normalizeConfigForSave();
      await saveSupportBotConfig(normalized);
      setBotConfig(normalized);
      setStepOptionDrafts(buildOptionDrafts(normalized.steps));
      toast.success("Support bot config saved.");
    } catch (err) {
      toast.error(err?.message || "Could not save support bot config.");
    } finally {
      setBotSaving(false);
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
          <h2>App Settings</h2>
          <div className="breadcrumb">Home / <span>App Settings</span></div>
        </div>
      </div>

      <div className="settings-grid">
        <section className="card">
          <div className="card-header">
            <span className="card-title">Store Controls</span>
          </div>
          <div className="settings-list">
            <label className="settings-row">
              <div>
                <strong>Maintenance Mode</strong>
                <p>Temporarily pause customer access.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={(e) => update("maintenanceMode", e.target.checked)}
              />
            </label>

            <label className="settings-row">
              <div>
                <strong>Allow Cash On Delivery</strong>
                <p>Enable COD for supported locations.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.allowCod}
                onChange={(e) => update("allowCod", e.target.checked)}
              />
            </label>

            <label className="settings-row">
              <div>
                <strong>Auto Approve Reviews</strong>
                <p>New reviews become visible instantly.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoApproveReviews}
                onChange={(e) => update("autoApproveReviews", e.target.checked)}
              />
            </label>

            <label className="settings-row">
              <div>
                <strong>Enable WhatsApp Notifications</strong>
                <p>Use queue-based WhatsApp alerts.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.enableWhatsapp}
                onChange={(e) => update("enableWhatsapp", e.target.checked)}
              />
            </label>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <span className="card-title">Commerce Defaults</span>
          </div>
          <div className="form-grid single">
            <div className="form-group">
              <label>Default Currency</label>
              <select
                value={settings.defaultCurrency}
                onChange={(e) => update("defaultCurrency", e.target.value)}
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div className="form-group">
              <label>Tax Percentage</label>
              <input
                type="number"
                min="0"
                max="50"
                value={settings.taxPercent}
                onChange={(e) => update("taxPercent", Number(e.target.value || 0))}
              />
            </div>
            <div className="selected-order-card">
              <div className="font-medium">Current Configuration</div>
              <div className="text-muted">
                {settings.defaultCurrency} currency with {settings.taxPercent}% tax.
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <span className="card-title">Support Bot Controls</span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveBot}
              disabled={botLoading || botSaving}
            >
              {botSaving ? "Saving..." : "Save Bot Config"}
            </button>
          </div>

          <div className="settings-list">
            <label className="settings-row">
              <div>
                <strong>Enable Support Bot</strong>
                <p>When disabled, bot automation pauses and admin handles chat manually.</p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(botConfig.enabled)}
                onChange={(e) =>
                  setBotConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                disabled={botLoading}
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
                  disabled={botLoading}
                />
                <label>{stepKey} Options (comma separated)</label>
                <input
                  value={
                    stepOptionDrafts[stepKey] ?? (stepValue?.options || []).join(", ")
                  }
                  onChange={(e) => updateStepOptionsDraft(stepKey, e.target.value)}
                  placeholder="Option A, Option B, Option C"
                  disabled={botLoading}
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
                      disabled={botLoading}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="selected-order-card">
              <div className="font-medium">Recent Bulk Leads</div>
              <div className="text-muted">
                {bulkLeads.length} lead(s) captured by support bot flow.
              </div>
              {bulkLeads.slice(0, 5).map((lead) => (
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
      </div>
    </>
  );
}
