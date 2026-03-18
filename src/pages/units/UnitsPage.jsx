import { useState } from "react";
import { MdAdd, MdDelete, MdEdit } from "react-icons/md";

const INITIAL_UNITS = [
  { id: "u-1", name: "Piece", short: "pc" },
  { id: "u-2", name: "Milliliter", short: "ml" },
  { id: "u-3", name: "Gram", short: "g" },
];

export default function UnitsPage() {
  const [units, setUnits] = useState(INITIAL_UNITS);
  const [name, setName] = useState("");
  const [short, setShort] = useState("");
  const [editingId, setEditingId] = useState("");

  const submit = (event) => {
    event.preventDefault();
    if (!name.trim() || !short.trim()) return;

    if (editingId) {
      setUnits((prev) =>
        prev.map((unit) =>
          unit.id === editingId
            ? { ...unit, name: name.trim(), short: short.trim().toLowerCase() }
            : unit
        )
      );
      setEditingId("");
    } else {
      setUnits((prev) => [
        {
          id: `u-${Date.now()}`,
          name: name.trim(),
          short: short.trim().toLowerCase(),
        },
        ...prev,
      ]);
    }

    setName("");
    setShort("");
  };

  const edit = (unit) => {
    setEditingId(unit.id);
    setName(unit.name);
    setShort(unit.short);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Units</h2>
          <div className="breadcrumb">Home / <span>Units</span></div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">{editingId ? "Edit Unit" : "Add Unit"}</span>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <div className="form-group">
            <label>Unit Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Piece" required />
          </div>
          <div className="form-group">
            <label>Short Form *</label>
            <input value={short} onChange={(e) => setShort(e.target.value)} placeholder="pc" required />
          </div>
          <div className="form-footer form-group full">
            <button className="btn btn-primary" type="submit"><MdAdd /> {editingId ? "Update" : "Add"}</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">All Units ({units.length})</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Short</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id}>
                  <td className="font-medium">{unit.name}</td>
                  <td>{unit.short}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-warning btn-sm btn-icon" onClick={() => edit(unit)}>
                        <MdEdit />
                      </button>
                      <button
                        className="btn btn-danger btn-sm btn-icon"
                        onClick={() => setUnits((prev) => prev.filter((item) => item.id !== unit.id))}
                      >
                        <MdDelete />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
