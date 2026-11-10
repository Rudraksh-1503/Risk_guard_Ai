import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import { fmtBytes } from "../utils/format";
import { datasetsAPI } from "../services/api";

export default function UploadZone({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) {
      setFile(accepted[0]);
      setName(accepted[0].name.replace(/\.[^.]+$/, ""));
      setError("");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"], "application/vnd.ms-excel": [".xls"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    maxSize: 100 * 1024 * 1024,
    multiple: false,
  });

  const handleUpload = async () => {
    if (!file || !name.trim()) { setError("Please select a file and provide a name."); return; }
    setUploading(true); setError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", name.trim());
    fd.append("description", description);
    try {
      const res = await datasetsAPI.upload(fd, setProgress);
      setFile(null); setName(""); setDescription(""); setProgress(0);
      onUploaded && onUploaded(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-zone-wrapper">
      <div {...getRootProps()} className={`dropzone${isDragActive ? " drag-active" : ""}${file ? " has-file" : ""}`}>
        <input {...getInputProps()} />
        {file ? (
          <div className="file-preview">
            <FileSpreadsheet size={40} color="#2563eb" />
            <div>
              <p className="file-name">{file.name}</p>
              <p className="file-meta">{fmtBytes(file.size)} · {file.type || "spreadsheet"}</p>
            </div>
            <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="dropzone-idle">
            <Upload size={40} color="#94a3b8" />
            <p className="dz-title">{isDragActive ? "Drop the file here …" : "Drag & drop CSV or Excel file"}</p>
            <p className="dz-sub">or click to browse · Max 100 MB</p>
          </div>
        )}
      </div>

      {file && (
        <div className="upload-form">
          <div className="form-group">
            <label>Dataset Name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter dataset name" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea className="input textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={2} />
          </div>
          {uploading && (
            <div className="progress-bar-wrap">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
              <span>{progress}%</span>
            </div>
          )}
          {error && <p className="error-msg">{error}</p>}
          <button className="btn-primary" onClick={handleUpload} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload & Analyze Dataset"}
          </button>
        </div>
      )}
    </div>
  );
}
