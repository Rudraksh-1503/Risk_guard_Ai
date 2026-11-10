import React, { useState, useEffect } from "react";
import { Brain, Database } from "lucide-react";
import { datasetsAPI } from "../services/api";
import { fmtDate } from "../utils/format";

export default function ModelRegistry() {
  const [allModels, setAllModels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const dsRes = await datasetsAPI.list();
      const analyzed = dsRes.data.filter((d) => d.is_analyzed);
      const models = [];
      for (const ds of analyzed) {
        try {
          const mRes = await datasetsAPI.getModels(ds.id);
          mRes.data.forEach((m) => models.push({ ...m, dataset_name: ds.name }));
        } catch (e) {}
      }
      setAllModels(models);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="page-content">
      <div className="page-title">
        <Brain size={22} />
        <h2>Model Registry</h2>
      </div>
      {loading ? (
        <p className="muted">Loading models…</p>
      ) : allModels.length === 0 ? (
        <div className="ds-empty">
          <Brain size={56} color="#cbd5e1" />
          <h3>No models trained yet</h3>
          <p>Upload a dataset and train a model to see it here.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Dataset</th><th>Model</th><th>Task</th>
                <th>Algorithm</th><th>Target</th><th>Metrics</th><th>Trained</th>
              </tr>
            </thead>
            <tbody>
              {allModels.map((m) => (
                <tr key={m.id}>
                  <td>{m.id}</td>
                  <td><Database size={12} /> {m.dataset_name}</td>
                  <td><strong>{m.model_name}</strong></td>
                  <td><span className={`badge badge-${m.task_type}`}>{m.task_type}</span></td>
                  <td>{m.algorithm}</td>
                  <td><code>{m.target_column}</code></td>
                  <td>
                    {m.metrics && (
                      <div className="metrics-mini">
                        {Object.entries(m.metrics).filter(([k]) => !["actual_vs_predicted","confusion_matrix"].includes(k)).slice(0, 2).map(([k, v]) => (
                          <span key={k}>{k}: <strong>{typeof v === "number" ? v.toFixed(3) : v}</strong></span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="muted">{fmtDate(m.training_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
