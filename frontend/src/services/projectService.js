import api from "./api.js";

export const getProjects = async (url = null) => {
  const response = url ? await api.get(url) : await api.get("/projects/");
  return response.data;
};

export const getAllProjects = async () => {
  const projects = [];
  let data = await getProjects();

  projects.push(...(data.results ?? data));

  while (data.next) {
    data = await getProjects(data.next);
    projects.push(...(data.results ?? data));
  }

  return projects;
};

export const getArchivedProjects = async (url = null) => {
  const response = url
    ? await api.get(url)
    : await api.get("/projects/", { params: { archived: "true" } });
  return response.data;
};

export const setProjectFavorite = async (id, isFavorite) => {
  const response = await api.patch(`/projects/${id}/`, {
    is_favorite: isFavorite,
  });
  return response.data;
};

export const archiveProject = async (id) => {
  const response = await api.post(`/projects/${id}/archive/`);
  return response.data;
};

export const unarchiveProject = async (id) => {
  const response = await api.post(`/projects/${id}/unarchive/`);
  return response.data;
};

export const getRecentProjects = async (limit = 4) => {
  const response = await api.get("/projects/recent/", { params: { limit } });
  return response.data;
};

export const markProjectOpened = async (id) => {
  const response = await api.post(`/projects/${id}/open/`);
  return response.data;
};

export const createProject = async (title, description) => {
  const response = await api.post("/projects/", {
    title,
    description,
  });
  return response.data;
};

export const getProject = async (id) => {
  const response = await api.get(`/projects/${id}/`);
  return response.data;
};

export const updateProject = async (id, fields) => {
  const response = await api.patch(`/projects/${id}/`, fields);
  return response.data;
};

export const deleteProject = async (id) => {
  const response = await api.delete(`/projects/${id}/`);
  return response.data;
};
