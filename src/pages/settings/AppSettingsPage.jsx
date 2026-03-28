import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  getBulkLeads,
  getDashboardMetricsSnapshotMeta,
  rebuildOrderCounters,
  getSupportBotConfig,
  saveSupportBotConfig,
} from "../../firestoreService";
import { useAuth } from "../../auth/AuthProvider";

export default function AppSettingsPage() {
  const { isSuperAdmin } = useAuth();
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
      BULK_INPUT: {
        text: "Please type your bulk order requirement (products, quantity, city, budget):",
        options: [],
      },
    },
  });
  const [bulkLeads, setBulkLeads] = useState([]);
  const [stepOptionDrafts, setStepOptionDrafts] = useState({});
  const [rebuildingCounters, setRebuildingCounters] = useState(false);
  const [maintenanceMeta, setMaintenanceMeta] = useState({
    loading: true,
    source: "",
    updatedAt: null,
    lastBackfillAt: null,
    totalOrders: 0,
    totalRevenue: 0,
  });

  const toMillis = (value) => {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.toDate === "function") return value.toDate().getTime();
    if (typeof value === "object") {
      const seconds = Number(
        value.seconds ?? value._seconds ?? value.sec ?? value.epochSeconds ?? 0
      );
      const nanos = Number(
        value.nanoseconds ?? value._nanoseconds ?? value.nanos ?? 0
      );
      if (Number.isFinite(seconds) && seconds > 0) {
        return seconds * 1000 + Math.floor((Number.isFinite(nanos) ? nanos : 0) / 1e6);
      }
    }
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const formatDateTime = (value) => {
    const ms = toMillis(value);
    if (!ms) return "Never";
    return new Date(ms).toLocaleString();
  };

  const loadMaintenanceMeta = async () => {
    setMaintenanceMeta((prev) => ({ ...prev, loading: true }));
    try {
      const snapshot = await getDashboardMetricsSnapshotMeta();
      setMaintenanceMeta({
        loading: false,
        source: String(snapshot?.source || ""),
        updatedAt: snapshot?.updatedAt || null,
        lastBackfillAt: snapshot?.lastBackfillAt || null,
        totalOrders: Number(snapshot?.ordersCount || 0),
        totalRevenue: Number(snapshot?.totalRevenue || 0),
      });
    } catch {
      setMaintenanceMeta((prev) => ({ ...prev, loading: false }));
    }
  };

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
        await loadMaintenanceMeta();
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
      Object.entries(botConfig.steps || {})
      .filter(([stepKey]) => stepKey !== "QUANTITY")
      .map(([stepKey, stepValue]) => {
        const raw = String(
          stepOptionDrafts[stepKey] ?? (stepValue?.options || []).join(", ")
        );
        const options = stepKey === "BULK_INPUT"
          ? []
          : raw
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

  const handleRebuildOrderCounters = async () => {
    if (!isSuperAdmin) {
      toast.error("Only super admins can run maintenance rebuilds.");
      return;
    }

    const proceed = window.confirm(
      "Run order counters backfill now? This may take some time on large datasets."
    );
    if (!proceed) return;

    setRebuildingCounters(true);
    try {
      const result = await rebuildOrderCounters();
      if (!result?.ok) {
        throw new Error("Backfill did not return success.");
      }

      toast.success(
        `Backfill complete • Orders: ${result.totalOrders || 0}, Users with orders: ${result.usersWithOrders || 0}`
      );
      await loadMaintenanceMeta();
    } catch (err) {
      toast.error(err?.message || "Could not rebuild order counters.");
    } finally {
      setRebuildingCounters(false);
    }
  };

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
            <span className="card-title">Maintenance Tools</span>
          </div>
          <div className="settings-list">
            <div className="settings-row" style={{ alignItems: "center", gap: 12 }}>
              <div>
                <strong>Rebuild Order Counters</strong>
                <p>
                  Recomputes `users.ordersCount` and dashboard aggregate totals from existing orders.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleRebuildOrderCounters}
                disabled={!isSuperAdmin || rebuildingCounters}
              >
                {rebuildingCounters ? "Running..." : "Run Rebuild"}
              </button>
            </div>
            {!isSuperAdmin ? (
              <p className="text-muted" style={{ marginTop: 8 }}>
                Only super admins can run maintenance rebuilds.
              </p>
            ) : null}

            <div className="selected-order-card" style={{ marginTop: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div className="font-medium">Backfill Status</div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={loadMaintenanceMeta}
                  disabled={maintenanceMeta.loading || rebuildingCounters}
                >
                  {maintenanceMeta.loading ? "Refreshing..." : "Refresh status"}
                </button>
              </div>
              <div className="text-muted" style={{ marginTop: 4 }}>
                Last backfill run: {maintenanceMeta.loading
                  ? "Loading..."
                  : formatDateTime(maintenanceMeta.lastBackfillAt)}
              </div>
              <div className="text-muted">
                Aggregate updated: {maintenanceMeta.loading
                  ? "Loading..."
                  : formatDateTime(maintenanceMeta.updatedAt)}
              </div>
              <div className="text-muted">
                Current aggregate source: {maintenanceMeta.loading
                  ? "Loading..."
                  : (maintenanceMeta.source || "unknown")}
              </div>
              <div className="text-muted">
                Orders tracked: {maintenanceMeta.loading ? "..." : maintenanceMeta.totalOrders}
              </div>
              <div className="text-muted">
                Revenue tracked: {maintenanceMeta.loading
                  ? "..."
                  : `₹${Number(maintenanceMeta.totalRevenue || 0).toLocaleString("en-IN")}`}
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
            {Object.entries(botConfig.steps || {})
              .filter(([stepKey]) => stepKey !== "QUANTITY")
              .map(([stepKey, stepValue]) => (
              <div className="form-group" key={stepKey}>
                <label>{stepKey} Message</label>
                <textarea
                  value={stepValue?.text || ""}
                  onChange={(e) => updateStepText(stepKey, e.target.value)}
                  placeholder={`Enter ${stepKey} message`}
                  disabled={botLoading}
                />
                {stepKey !== "BULK_INPUT" ? (
                  <>
                    <label>{stepKey} Options (comma separated)</label>
                    <input
                      value={
                        stepOptionDrafts[stepKey] ?? (stepValue?.options || []).join(", ")
                      }
                      onChange={(e) => updateStepOptionsDraft(stepKey, e.target.value)}
                      placeholder="Option A, Option B, Option C"
                      disabled={botLoading}
                    />
                  </>
                ) : (
                  <p className="text-muted" style={{ marginTop: 8 }}>
                    This step accepts free text from user after clicking Bulk Order.
                  </p>
                )}
              </div>
            ))}

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
                      Requirement: {lead.requirement || "-"}
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
