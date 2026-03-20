import { useMemo } from "react";
import { getQuickReference, generateResolutionCard, getAllImageTypes } from "../../utils/imageResolutions";

export default function ImageResolutionGuidePage() {
  const quickRef = useMemo(() => getQuickReference(), []);
  const allTypes = useMemo(() => getAllImageTypes(), []);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Image Resolution Guide</h2>
          <div className="breadcrumb">Home / <span>Image Resolution Guide</span></div>
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <span className="card-title">Quick Reference Table</span>
          <p className="card-subtitle">All image types and their resolution requirements</p>
        </div>

        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Image Type</th>
                <th>Optimal Resolution</th>
                <th>Minimum Resolution</th>
                <th>Aspect Ratio</th>
              </tr>
            </thead>
            <tbody>
              {quickRef.map((item) => (
                <tr key={item.type}>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td className="font-mono">{item.optimal}</td>
                  <td className="font-mono">{item.minimum}</td>
                  <td>{item.aspectRatio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <span className="card-title">Detailed Guidelines</span>
          <p className="card-subtitle">Complete specifications for each image type</p>
        </div>

        <div className="resolution-grid">
          {allTypes.map((type) => {
            const card = generateResolutionCard(type);
            if (!card) return null;

            return (
              <div key={type} className="resolution-card">
                <div className="resolution-card-header">
                  <h3>{card.title}</h3>
                  <p className="text-muted">{card.description}</p>
                </div>

                <div className="resolution-card-specs">
                  {card.specs.map((spec, idx) => (
                    <div key={idx} className="spec-row">
                      <span className="spec-label">{spec.label}</span>
                      <span className="spec-value font-mono">{spec.value}</span>
                    </div>
                  ))}
                </div>

                <div className="resolution-card-notes">
                  <strong>📝 Note:</strong> {card.notes}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <span className="card-title">General Best Practices</span>
        </div>

        <div className="best-practices-list">
          <div className="practice-item">
            <h4>✓ Use High-Quality Images</h4>
            <p>Upload images at or above the optimal resolution for best visual quality and zoom capability.</p>
          </div>

          <div className="practice-item">
            <h4>✓ Maintain Aspect Ratios</h4>
            <p>Follow recommended aspect ratios to avoid distortion and ensure consistency across the platform.</p>
          </div>

          <div className="practice-item">
            <h4>✓ Optimize File Size</h4>
            <p>Use compression tools to meet file size limits without compromising quality (tools: TinyPNG, ImageOptim).</p>
          </div>

          <div className="practice-item">
            <h4>✓ Consider Mobile Viewing</h4>
            <p>Test how images look on mobile devices. Text and important elements should be clearly visible.</p>
          </div>

          <div className="practice-item">
            <h4>✓ Use Recommended Formats</h4>
            <p>Modern formats like WebP provide better compression. Fallback to JPEG/PNG for compatibility.</p>
          </div>

          <div className="practice-item">
            <h4>✓ Clear and Centered Subject</h4>
            <p>For product and category images, ensure subject is clear, well-lit, and centered in the frame.</p>
          </div>

          <div className="practice-item">
            <h4>✓ Consistent Styling</h4>
            <p>Maintain consistent backgrounds, lighting, and composition across similar image types.</p>
          </div>

          <div className="practice-item">
            <h4>✓ Test Before Publishing</h4>
            <p>Always preview images on different devices before making them live to catch any issues early.</p>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <span className="card-title">Recommended Tools</span>
        </div>

        <div className="tools-grid">
          <div className="tool-card">
            <h4>Image Compression</h4>
            <ul>
              <li><a href="https://tinypng.com" target="_blank" rel="noreferrer">TinyPNG</a> - Lossy compression</li>
              <li><a href="https://imageoptim.com" target="_blank" rel="noreferrer">ImageOptim</a> - Mac tool</li>
              <li><a href="https://compressor.io" target="_blank" rel="noreferrer">Compressor.io</a> - Web-based</li>
            </ul>
          </div>

          <div className="tool-card">
            <h4>Image Resizing</h4>
            <ul>
              <li><a href="https://www.photopea.com" target="_blank" rel="noreferrer">Photopea</a> - Online editor</li>
              <li><a href="https://www.pixlr.com" target="_blank" rel="noreferrer">Pixlr</a> - Free online</li>
              <li><a href="https://www.irfanview.com" target="_blank" rel="noreferrer">IrfanView</a> - Desktop app</li>
            </ul>
          </div>

          <div className="tool-card">
            <h4>Aspect Ratio Checker</h4>
            <ul>
              <li><a href="https://aspectratiocalculator.com" target="_blank" rel="noreferrer">Aspect Ratio Calculator</a></li>
              <li><a href="https://www.canva.com" target="_blank" rel="noreferrer">Canva</a> - Design templates</li>
              <li>Built-in browser DevTools (Right-click → Inspect)</li>
            </ul>
          </div>

          <div className="tool-card">
            <h4>Image Quality Check</h4>
            <ul>
              <li><a href="https://tools.pingdom.com" target="_blank" rel="noreferrer">Pingdom Tools</a> - Performance</li>
              <li><a href="https://pagespeed.web.dev" target="_blank" rel="noreferrer">Google PageSpeed</a></li>
              <li><a href="https://squoosh.app" target="_blank" rel="noreferrer">Google Squoosh</a></li>
            </ul>
          </div>
        </div>
      </section>

      <style>{`
        .resolution-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 16px;
          margin-top: 16px;
        }

        .resolution-card {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 14px;
          background: #f8fafc;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .resolution-card-header h3 {
          margin: 0;
          font-size: 15px;
          color: #0f172a;
        }

        .resolution-card-header p {
          margin: 4px 0 0;
          font-size: 12px;
          color: #64748b;
        }

        .resolution-card-specs {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 10px;
          background: #fff;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .spec-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
        }

        .spec-label {
          color: #64748b;
          font-weight: 600;
        }

        .spec-value {
          color: #0f172a;
          font-weight: 600;
        }

        .resolution-card-notes {
          font-size: 12px;
          color: #475569;
          line-height: 1.4;
          padding: 8px;
          background: #fef3c7;
          border-radius: 6px;
          border-left: 3px solid #f59e0b;
        }

        .best-practices-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 14px;
          margin-top: 14px;
        }

        .practice-item {
          padding: 12px;
          border-left: 3px solid #0175c2;
          background: #eff6ff;
          border-radius: 6px;
        }

        .practice-item h4 {
          margin: 0 0 6px;
          font-size: 13px;
          color: #0f172a;
        }

        .practice-item p {
          margin: 0;
          font-size: 12px;
          color: #475569;
          line-height: 1.5;
        }

        .tools-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 14px;
          margin-top: 14px;
        }

        .tool-card {
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #f8fafc;
        }

        .tool-card h4 {
          margin: 0 0 8px;
          font-size: 13px;
          color: #0f172a;
        }

        .tool-card ul {
          margin: 0;
          padding: 0 0 0 16px;
        }

        .tool-card li {
          margin-bottom: 6px;
          font-size: 12px;
        }

        .tool-card a {
          color: #0175c2;
          text-decoration: none;
        }

        .tool-card a:hover {
          text-decoration: underline;
        }

        .font-mono {
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 12px;
          color: #0f172a;
        }

        .text-muted {
          color: #64748b;
        }

        @media (max-width: 768px) {
          .resolution-grid {
            grid-template-columns: 1fr;
          }

          .best-practices-list {
            grid-template-columns: 1fr;
          }

          .tools-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
