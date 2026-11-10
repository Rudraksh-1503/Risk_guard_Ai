export const fmtNumber = (n) => {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString();
};

export const fmtPct = (n, decimals = 1) => {
  if (n === null || n === undefined) return "—";
  return `${Number(n).toFixed(decimals)}%`;
};

export const fmtBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

export const fmtDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
};

export const qualityColor = (score) => {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
};

export const severityColor = (sev) => {
  const map = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
  return map[sev] || "#6b7280";
};
