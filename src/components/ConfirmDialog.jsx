import { MdWarning } from "react-icons/md";

export default function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal confirm-modal">
        <div className="confirm-body">
          <div className="confirm-icon"><MdWarning /></div>
          <h4>{title || "Are you sure?"}</h4>
          <p>{message || "This action cannot be undone."}</p>
        </div>
        <div className="confirm-footer">
          <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}
