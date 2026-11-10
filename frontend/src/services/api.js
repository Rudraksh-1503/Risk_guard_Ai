import axios from "axios";

const API = axios.create({ baseURL: "/api" });

export const datasetsAPI = {
  upload: (formData, onProgress) =>
    API.post("/datasets", formData, {
      onUploadProgress: (e) => onProgress && onProgress(Math.round((e.loaded / e.total) * 100)),
    }),
  list: () => API.get("/datasets"),
  get: (id) => API.get(`/datasets/${id}`),
  preview: (id, rows = 10) => API.get(`/datasets/${id}/preview?rows=${rows}`),
  analyze: (id) => API.post(`/datasets/${id}/analyze`),
  getAnalysis: (id) => API.get(`/datasets/${id}/analysis`),
  updateCategory: (id, category) => API.patch(`/datasets/${id}/category`, { category }),
  train: (id, payload) => API.post(`/datasets/${id}/train`, payload),
  getModels: (id) => API.get(`/datasets/${id}/models`),
  getInsights: (id) => API.get(`/datasets/${id}/insights`),
  createReport: (id) => API.post(`/datasets/${id}/report`),
  downloadReport: (id, reportId) => `/api/datasets/${id}/report/${reportId}/download`,
  exportCsv: (id) => `/api/datasets/${id}/export/csv`,
  delete: (id) => API.delete(`/datasets/${id}`),
};

export const premiumAPI = {
  analytics: (datasetId) => API.get(`/premium/analytics/${datasetId}`),
  predict: (modelId, inputData) => API.post("/premium/predict", { model_id: modelId, input_data: inputData }),
};

export const fraudAPI = {
  analytics: (datasetId) => API.get(`/fraud/analytics/${datasetId}`),
};

export const forecastAPI = {
  analytics: (datasetId, periods = 6) => API.get(`/forecast/analytics/${datasetId}?periods=${periods}`),
};

export const explainAPI = {
  explain: (modelId, inputData) => API.post("/explain/predict", { model_id: modelId, input_data: inputData }),
  whatif: (modelId, scenarios) => API.post("/explain/whatif", { model_id: modelId, scenarios }),
  listModels: () => API.get("/explain/models"),
};

export const authAPI = {
  register: (data) => API.post("/auth/register", data),
  login: (email, password) => {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    return API.post("/auth/login", form, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  },
  me: () => API.get("/auth/me"),
};

export const claimsAPI = {
  submit: (formData) => API.post("/claims", formData),
  myClaims: () => API.get("/claims/my"),
  getClaim: (id) => API.get(`/claims/${id}`),
  getHistory: (id) => API.get(`/claims/${id}/history`),
  addDocument: (id, formData) => API.post(`/claims/${id}/documents`, formData),
  // Admin
  listAll: (params) => API.get("/claims", { params }),
  adminStats: () => API.get("/claims/admin/stats"),
  review: (id, data) => API.patch(`/claims/${id}/review`, data),
  downloadDoc: (docId) => `/api/claims/documents/${docId}/download`,
};


// Attach JWT token from localStorage to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("rg_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default API;
