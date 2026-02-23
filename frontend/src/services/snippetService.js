import api from './api.js';


export const getSnippets = async (projectId, url = null) => {
    const response = url
        ? await api.get(url)
        : await api.get(`/projects/${projectId}/snippets/`);
    return response.data;
};

export const createSnippet = async (projectId, title, language, content, description) => {
    const response = await api.post(`/projects/${projectId}/snippets/`, {
        title,
        language,
        content,
        description
    });
    return response.data;
};

export const getSnippet = async (snippetId) => {
    const response = await api.get(`/snippets/${snippetId}/`);
    return response.data;
};

export const updateSnippet = async (snippetId, title, language, content, description) => {
    const response = await api.patch(`/snippets/${snippetId}/`, {
        title,
        language,
        content,
        description
    });
    return response.data;
};

export const deleteSnippet = async (snippetId) => {
    const response = await api.delete(`/snippets/${snippetId}/`);
    return response.data;
};
