import { useState } from "react";

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
      </div>
    </>
  );
}
