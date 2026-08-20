import api from "./api.js";

export const getDocuments = async (projectId, url = null, folderId = null) => {
  if (url) {
    const response = await api.get(url);
    return response.data;
  }

  const response = await api.get(`/projects/${projectId}/documents/`, {
    params: { folder: folderId ?? "null" },
  });
  return response.data;
};

export const createDocument = async (
  projectId,
  title,
  content,
  folderId = null,
) => {
  const response = await api.post(`/projects/${projectId}/documents/`, {
    title,
    content,
    folder: folderId,
  });
  return response.data;
};

export const getDocument = async (documentId) => {
  const response = await api.get(`/documents/${documentId}/`);
  return response.data;
};

export const updateDocument = async (documentId, title, content) => {
  const response = await api.patch(`/documents/${documentId}/`, {
    title,
    content,
  });
  return response.data;
};

export const duplicateDocument = async (documentId) => {
  const response = await api.post(`/documents/${documentId}/duplicate/`);
  return response.data;
};

export const getPinnedDocuments = async (projectId) => {
  const response = await api.get(`/projects/${projectId}/pinned/`);
  return response.data;
};

export const setDocumentPinned = async (documentId, isPinned) => {
  const response = await api.patch(`/documents/${documentId}/`, {
    is_pinned: isPinned,
  });
  return response.data;
};

export const moveDocument = async (documentId, { project, folder }) => {
  const response = await api.post(`/documents/${documentId}/move/`, {
    project,
    folder,
  });
  return response.data;
};

export const deleteDocument = async (documentId) => {
  const response = await api.delete(`/documents/${documentId}/`);
  return response.data;
};
