import axios from "axios";

const API_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((request) => {
  const token = localStorage.getItem("meeting_ai_token");
  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  }
  return request;
});

export const saveToken = (token: string): void => {
  localStorage.setItem("meeting_ai_token", token);
};

export const clearToken = (): void => {
  localStorage.removeItem("meeting_ai_token");
};

export const hasToken = (): boolean => Boolean(localStorage.getItem("meeting_ai_token"));

// Декодируем payload JWT без верификации — только для UI-решений; сервер всё равно проверяет токен
export const getTokenPayload = (): { userId?: string; workspaceId?: string; isAdmin?: boolean } => {
  const token = localStorage.getItem("meeting_ai_token");
  if (!token) return {};
  try {
    const base64 = token.split(".")[1] ?? "";
    return JSON.parse(atob(base64.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
};
