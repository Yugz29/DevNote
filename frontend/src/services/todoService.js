import api from './api';


export const getTodos = async (projectId) => {
    const response = await api.get(`/projects/${projectId}/todos/`);
    return response.data;
};

export const createTodo = async (projectId, title, description, status, priority) => {
    const response = await api.post(`/projects/${projectId}/todos/`, {
        title,
        description,
        status,
        priority
    });
    return response.data;
};

export const getTodo = async (todoId) => {
    const response = await api.get(`/todos/${todoId}/`);
    return response.data;
};

export const updateTodo = async (todoId, title, description, status, priority) => {
    const response = await api.patch(`/todos/${todoId}/`, {
        title,
        description,
        status,
        priority
    });
    return response.data;
};

export const deleteTodo = async (todoId) => {
    const response = await api.delete(`/todos/${todoId}/`);
    return response.data;
};
