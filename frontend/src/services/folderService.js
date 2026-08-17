import api from "./api.js";

export const getFolders = async (projectId, parentId = null, url = null) => {
  if (url) {
    const response = await api.get(url);
    return response.data;
  }

  const response = await api.get(`/projects/${projectId}/folders/`, {
    params: { parent: parentId ?? "null" },
  });
  return response.data;
};

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

export const getFolderContents = async (folderId, url = null) => {
  const response = url
    ? await api.get(url)
    : await api.get(`/folders/${folderId}/contents/`);
  return response.data;
};
