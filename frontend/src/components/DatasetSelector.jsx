import React, { useEffect, useState } from "react";
import { Database, RefreshCw } from "lucide-react";
import { datasetsAPI } from "../services/api";

export default function DatasetSelector({ onSelect, selectedId, filterAnalyzed = true }) {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await datasetsAPI.list();
      const list = filterAnalyzed ? res.data.filter((d) => d.is_analyzed) : res.data;
      setDatasets(list);
      if (!selectedId && list.length > 0) onSelect(list[0]);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  return (
    <div className="ds-selector">
      <label><Database size={14} /> Dataset</label>
      <div className="ds-select-row">
        <select
          value={selectedId || ""}
          onChange={(e) => {
            const ds = datasets.find((d) => d.id === Number(e.target.value));
            if (ds) onSelect(ds);
          }}
        >
          <option value="">Select dataset…</option>
          {datasets.map((ds) => (
            <option key={ds.id} value={ds.id}>
              {ds.name} ({ds.row_count?.toLocaleString() ?? "?"} rows)
            </option>
          ))}
        </select>
        <button className="btn-icon" onClick={load} title="Refresh">
          {loading ? <RefreshCw size={14} className="spin" /> : <RefreshCw size={14} />}
        </button>
      </div>
      {datasets.length === 0 && !loading && (
        <p className="ds-selector-hint">No analyzed datasets. <a href="/datasets">Upload one →</a></p>
      )}
    </div>
  );
}
