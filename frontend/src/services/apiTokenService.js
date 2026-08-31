import api from "./api.js";
import { ensureCsrfCookie } from "./authService.js";

export const getApiTokens = async () => {
  const response = await api.get("/auth/tokens/");
  return response.data;
};

export const createApiToken = async (name, expiresInDays) => {
  await ensureCsrfCookie();
  const response = await api.post("/auth/tokens/", {
    name,
    expires_in_days: expiresInDays,
  });
  return response.data;
};

export const revokeApiToken = async (tokenId) => {
  await ensureCsrfCookie();
  const response = await api.delete(`/auth/tokens/${tokenId}/`);
  return response.data;
};
