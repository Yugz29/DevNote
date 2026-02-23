import api from './api.js';

export const getProjects = async (url = null) => {
    const response = url
        ? await api.get(url)
        : await api.get('/projects/');
    return response.data;
};

export const createProject = async (title, description) => {
    const response = await api.post('/projects/', {
        title,
        description
    });
    return response.data;
};

export const getProject = async (id) => {
    const response = await api.get(`/projects/${id}/`);
    return response.data;
};

export const updateProject = async (id, title, description) => {
    const response = await api.patch(`/projects/${id}/`, {
        title,
        description
    });
    return response.data;
};

export const deleteProject = async (id) => {
    const response = await api.delete(`/projects/${id}/`);
    return response.data;
};
