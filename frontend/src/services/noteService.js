import api from './api';


export const getNotes = async (projectId, url = null) => {
    const response = url
        ? await api.get(url)
        : await api.get(`/projects/${projectId}/notes/`);
    return response.data;
};

export const createNote = async (projectId, title, content) => {
    const response = await api.post(`/projects/${projectId}/notes/`, {
        title,
        content
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
        content
    });
    return response.data;
};

export const deleteNote = async (noteId) => {
    const response = await api.delete(`/notes/${noteId}/`);
    return response.data;
};
