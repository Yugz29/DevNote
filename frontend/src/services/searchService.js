import api from "./api.js";

export const search = async (query, type = null, projectId = null) => {
  const params = { q: query };
  if (type) params.type = type;
  if (projectId) params.project = projectId;

  const response = await api.get("/search/", { params });
  return response.data;
};
