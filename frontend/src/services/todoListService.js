import api from "./api.js";

export const getTodoLists = async (projectId) => {
  const response = await api.get(`/projects/${projectId}/todo-lists/`);
  return response.data;
};

export const createTodoList = async (projectId, name) => {
  const response = await api.post(`/projects/${projectId}/todo-lists/`, {
    name,
  });
  return response.data;
};

export const renameTodoList = async (listId, name) => {
  const response = await api.patch(`/todo-lists/${listId}/`, { name });
  return response.data;
};

export const deleteTodoList = async (listId) => {
  const response = await api.delete(`/todo-lists/${listId}/`);
  return response.data;
};
