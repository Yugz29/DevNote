import api from "./api.js";

export const createFolder = async (
  projectId,
  name,
  parentId = null,
  resourceType = "documents",
) => {
  const response = await api.post(`/projects/${projectId}/folders/`, {
    name,
    parent: parentId,
    resource_type: resourceType,
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

export const getFolders = async (
  projectId,
  parentId = null,
  url = null,
  resourceType = "documents",
) => {
  if (url) {
    const response = await api.get(url);
    return response.data;
  }

  const response = await api.get(`/projects/${projectId}/folders/`, {
    params: { parent: parentId ?? "null", resource_type: resourceType },
  });
  return response.data;
};

export const getLevelContents = async (
  projectId,
  folderId,
  url = null,
  resourceType = "documents",
) => {
  if (url) {
    const response = await api.get(url);
    return response.data;
  }

  const response = folderId
    ? await api.get(`/folders/${folderId}/contents/`)
    : await api.get(`/projects/${projectId}/contents/`, {
        params: { resource_type: resourceType },
      });
  return response.data;
};
