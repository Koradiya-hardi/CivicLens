import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api",
});


api.interceptors.request.use((config) => {
  const token = localStorage.getItem("civiclens_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadToken = !!localStorage.getItem("civiclens_token");
      localStorage.removeItem("civiclens_token");

      const url: string = error.config?.url ?? "";
      const isAuthForm = url.includes("/auth/login") || url.includes("/auth/register");
      const onAuthPage = ["/login", "/register"].includes(window.location.pathname);
      if (hadToken && !isAuthForm && !onAuthPage) authRedirect.toLogin();
    }
    return Promise.reject(error);
  }
);

/** Wrapped in an object so tests can replace it (jsdom can't really navigate). */
export const authRedirect = {
  toLogin: () => window.location.assign("/login"),
};