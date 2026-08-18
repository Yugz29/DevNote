import api from "./api.js";

export const getNotes = async (projectId, url = null, folderId = null) => {
  if (url) {
    const response = await api.get(url);
    return response.data;
  }

  const response = await api.get(`/projects/${projectId}/notes/`, {
    params: { folder: folderId ?? "null" },
  });
  return response.data;
};

export const createNote = async (
  projectId,
  title,
  content,
  folderId = null,
) => {
  const response = await api.post(`/projects/${projectId}/notes/`, {
    title,
    content,
    folder: folderId,
  });
  return response.data;
};

export const getNote = async (noteId) => {
  const response = await api.get(`/notes/${noteId}/`);
  return response.data;
};

export const updateNote = async (noteId, title, content) => {
  const response = await api.patch(`/notes/${noteId}/`, {
    title,
    content,
  });
  return response.data;
};

export const moveNote = async (noteId, folderId) => {
  const response = await api.patch(`/notes/${noteId}/`, { folder: folderId });
  return response.data;
};

export const deleteNote = async (noteId) => {
  const response = await api.delete(`/notes/${noteId}/`);
  return response.data;
};
