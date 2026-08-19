import api from "./api.js";

export const createSnippet = async (
  projectId,
  title,
  language,
  content,
  description,
  folderId = null,
) => {
  const response = await api.post(`/projects/${projectId}/snippets/`, {
    title,
    language,
    content,
    description,
    folder: folderId,
  });
  return response.data;
};

export const moveSnippet = async (snippetId, folderId) => {
  const response = await api.patch(`/snippets/${snippetId}/`, {
    folder: folderId,
  });
  return response.data;
};

export const getSnippet = async (snippetId) => {
  const response = await api.get(`/snippets/${snippetId}/`);
  return response.data;
};

export const updateSnippet = async (
  snippetId,
  title,
  language,
  content,
  description,
) => {
  const response = await api.patch(`/snippets/${snippetId}/`, {
    title,
    language,
    content,
    description,
  });
  return response.data;
};

export const getPinnedSnippets = async (projectId) => {
  const response = await api.get(`/projects/${projectId}/snippets/pinned/`);
  return response.data;
};

export const setSnippetPinned = async (snippetId, isPinned) => {
  const response = await api.patch(`/snippets/${snippetId}/`, {
    is_pinned: isPinned,
  });
  return response.data;
};

export const duplicateSnippet = async (snippetId) => {
  const response = await api.post(`/snippets/${snippetId}/duplicate/`);
  return response.data;
};

export const deleteSnippet = async (snippetId) => {
  const response = await api.delete(`/snippets/${snippetId}/`);
  return response.data;
};
