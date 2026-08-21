import api from "./api.js";

export const getTodos = async (projectId, url = null) => {
  const response = url
    ? await api.get(url)
    : await api.get(`/projects/${projectId}/todos/`);
  return response.data;
};

export const getAllTodos = async (projectId) => {
  let url = null;
  let allResults = [];

  do {
    const data = await getTodos(projectId, url);
    const items = data.results ?? data;
    allResults = [...allResults, ...items];
    url = data.next ?? null;
  } while (url);

  return allResults;
};

export const countOpenTodos = async () => {
  const responses = await Promise.all(
    ["pending", "in_progress"].map((status) =>
      api.get("/todos/", { params: { status } }),
    ),
  );

  return responses.reduce(
    (total, response) => total + (response.data.count ?? 0),
    0,
  );
};

export const getPinnedTodos = async (projectId) => {
  const response = await api.get(`/projects/${projectId}/todos/pinned/`);
  return response.data;
};

export const createTodo = async (
  projectId,
  title,
  description,
  status,
  priority,
  list = null,
) => {
  const response = await api.post(`/projects/${projectId}/todos/`, {
    title,
    description,
    status,
    priority,
    list,
  });
  return response.data;
};

export const getTodo = async (todoId) => {
  const response = await api.get(`/todos/${todoId}/`);
  return response.data;
};

export const updateTodo = async (
  todoId,
  title,
  description,
  status,
  priority,
) => {
  const payload = {};
  if (title !== undefined) payload.title = title;
  if (description !== undefined) payload.description = description;
  if (status !== undefined) payload.status = status;
  if (priority !== undefined) payload.priority = priority;

  const response = await api.patch(`/todos/${todoId}/`, payload);
  return response.data;
};

export const setTodoPinned = async (todoId, isPinned) => {
  const response = await api.patch(`/todos/${todoId}/`, {
    is_pinned: isPinned,
  });
  return response.data;
};

export const moveTodo = async (todoId, { project, list }) => {
  const response = await api.post(`/todos/${todoId}/move/`, { project, list });
  return response.data;
};

export const deleteTodo = async (todoId) => {
  const response = await api.delete(`/todos/${todoId}/`);
  return response.data;
};
