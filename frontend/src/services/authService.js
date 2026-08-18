import api from "./api.js";

let csrfPromise = null;

export const ensureCsrfCookie = async () => {
  if (!csrfPromise) {
    csrfPromise = api.get("/auth/csrf/").catch((error) => {
      csrfPromise = null;
      throw error;
    });
  }

  await csrfPromise;
};

export const login = async (email, password) => {
  await ensureCsrfCookie();
  const response = await api.post("/auth/login/", {
    email,
    password,
  });
  return response.data;
};

export const register = async (
  email,
  password,
  password2,
  firstName,
  lastName,
  username = null,
) => {
  const data = {
    email,
    password,
    password2,
    first_name: firstName,
    last_name: lastName,
  };

  if (username) {
    data.username = username;
  }

  await ensureCsrfCookie();
  const response = await api.post("/auth/register/", data);
  return response.data;
};

export const logout = async () => {
  await ensureCsrfCookie();
  const response = await api.post("/auth/logout/");
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get("/auth/me/");
  return response.data;
};

export const changePassword = async (
  currentPassword,
  newPassword,
  newPassword2,
) => {
  await ensureCsrfCookie();
  const response = await api.post("/auth/password/", {
    current_password: currentPassword,
    new_password: newPassword,
    new_password2: newPassword2,
  });
  return response.data;
};
