import api from "./api.js";

export const createFolder = async (projectId, name, parentId = null) => {
  const response = await api.post(`/projects/${projectId}/folders/`, {
    name,
    parent: parentId,
  });
  return response.data;
};

export const updateFolder = async (folderId, data) => {
  const response = await api.patch(`/folders/${folderId}/`, data);
  return response.data;
};

export const deleteFolder = async (folderId, { confirm = false } = {}) => {
  const response = await api.delete(`/folders/${folderId}/`, {
    params: confirm ? { confirm: "true" } : undefined,
  });
  return response.data;
};

export const getLevelContents = async (projectId, folderId, url = null) => {
  if (url) {
    const response = await api.get(url);
    return response.data;
  }

  const response = folderId
    ? await api.get(`/folders/${folderId}/contents/`)
    : await api.get(`/projects/${projectId}/contents/`);
  return response.data;
};
