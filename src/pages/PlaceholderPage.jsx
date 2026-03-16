import { MdConstruction } from "react-icons/md";

export default function PlaceholderPage({ title }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{title}</span>
      </div>
      <div className="empty-state">
        <MdConstruction />
        <p>{title} page is ready in the sidebar and can be implemented next.</p>
      </div>
    </div>
  );
}
