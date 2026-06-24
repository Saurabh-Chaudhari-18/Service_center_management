/**
 * API Client with JWT authentication and request/response interceptors
 */
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";

// API Base URL - configurable via environment (export for direct fetch use)
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001/api";

// Token storage keys (sessionStorage limits XSS persistence vs localStorage)
const ACCESS_TOKEN_KEY = "scm_access_token";
const REFRESH_TOKEN_KEY = "scm_refresh_token";
const CURRENT_BRANCH_KEY = "scm_current_branch";

const storage =
  typeof window !== "undefined" ? window.sessionStorage : null;

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
  // Render (and similar) cold starts often exceed 30s; login uses a longer override below.
  timeout: 60000,
});

// =====================================================
// Token Management
// =====================================================

export const tokenManager = {
  getAccessToken: (): string | null => {
    if (!storage) return null;
    const token = storage.getItem(ACCESS_TOKEN_KEY);
    if (token) return token;
    const legacy =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(ACCESS_TOKEN_KEY)
        : null;
    if (legacy) {
      storage.setItem(ACCESS_TOKEN_KEY, legacy);
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
    return legacy;
  },

  getRefreshToken: (): string | null => {
    if (!storage) return null;
    const token = storage.getItem(REFRESH_TOKEN_KEY);
    if (token) return token;
    const legacy =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(REFRESH_TOKEN_KEY)
        : null;
    if (legacy) {
      storage.setItem(REFRESH_TOKEN_KEY, legacy);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    return legacy;
  },

  setTokens: (access: string, refresh?: string): void => {
    if (!storage) return;
    storage.setItem(ACCESS_TOKEN_KEY, access);
    if (refresh) {
      storage.setItem(REFRESH_TOKEN_KEY, refresh);
    }
    if (typeof document !== "undefined") {
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `scm_session=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${secure}`;
    }
  },

  clearTokens: (): void => {
    if (!storage) return;
    storage.removeItem(ACCESS_TOKEN_KEY);
    storage.removeItem(REFRESH_TOKEN_KEY);
    storage.removeItem(CURRENT_BRANCH_KEY);
    if (typeof document !== "undefined") {
      document.cookie = "scm_session=; path=/; max-age=0";
    }
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(CURRENT_BRANCH_KEY);
    }
  },

  getCurrentBranchId: (): string | null => {
    if (!storage) return null;
    return storage.getItem(CURRENT_BRANCH_KEY);
  },

  setCurrentBranchId: (branchId: string): void => {
    if (!storage) return;
    storage.setItem(CURRENT_BRANCH_KEY, branchId);
  },
};

// =====================================================
// Request Interceptor - Add auth token
// =====================================================

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenManager.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add branch context if available (for branch-scoped requests)
    const branchId = tokenManager.getCurrentBranchId();
    if (branchId && config.headers) {
      config.headers["X-Branch-ID"] = branchId;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// =====================================================
// Response Interceptor - Handle errors & token refresh
// =====================================================

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle 401 Unauthorized - Token expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for token refresh
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = tokenManager.getRefreshToken();

      if (!refreshToken) {
        tokenManager.clearTokens();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(
          `${API_BASE_URL}/auth/token/refresh/`,
          refreshToken ? { refresh: refreshToken } : {},
          { timeout: 120000, withCredentials: true },
        );

        const { access } = response.data;
        tokenManager.setTokens(access);

        isRefreshing = false;
        onTokenRefreshed(access);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        tokenManager.clearTokens();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    // Format error message
    const errorMessage = formatErrorMessage(error);
    return Promise.reject(new Error(errorMessage));
  },
);

// =====================================================
// Error Message Formatter
// =====================================================

function formatErrorMessage(error: AxiosError<unknown>): string {
  if (!error.response) {
    if (error.code === "ECONNABORTED") {
      return "Request timed out. If the API is on a free host, the first request after idle can take 1–2 minutes—try again. Otherwise check NEXT_PUBLIC_API_URL (must end with /api).";
    }
    return "Network error. Please check your connection.";
  }

  const { status, data } = error.response;

  if (typeof data === "object" && data !== null) {
    const d = data as Record<string, unknown>;
    const err = d.error as Record<string, unknown> | undefined;
    if (
      d.success === false &&
      err &&
      typeof err.message === "string" &&
      err.message
    ) {
      const fields =
        (err.fields as Record<string, unknown> | undefined) ??
        (err.field_errors as Record<string, unknown> | undefined);
      if (fields && Object.keys(fields).length > 0) {
        const lines: string[] = [];
        Object.entries(fields).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            lines.push(`${key}: ${value.join(", ")}`);
          } else if (value != null) {
            lines.push(`${key}: ${String(value)}`);
          }
        });
        if (lines.length > 0) {
          return `${err.message}\n${lines.join("\n")}`;
        }
      }
      return err.message;
    }
  }

  // Handle specific status codes
  switch (status) {
    case 400:
      // Validation errors (non-envelope or legacy DRF shape)
      if (typeof data === "object" && data !== null) {
        const errors: string[] = [];
        Object.entries(data as Record<string, unknown>).forEach(
          ([key, value]) => {
            if (key === "success" || key === "error") return;
            if (Array.isArray(value)) {
              errors.push(`${key}: ${value.join(", ")}`);
            } else if (typeof value === "string") {
              errors.push(`${key}: ${value}`);
            }
          },
        );
        if (errors.length > 0) {
          return errors.join("\n");
        }
        return `Invalid request: ${JSON.stringify(data)}`;
      }
      return "Invalid request. Please check your input.";

    case 401:
      return "Authentication required. Please login again.";

    case 403:
      return "You do not have permission to perform this action.";

    case 404:
      return "The requested resource was not found.";

    case 409: {
      const d409 = data as { detail?: string; error?: { message?: string } };
      return (
        d409?.error?.message ||
        d409?.detail ||
        "Conflict error. The resource may already exist."
      );
    }

    case 422:
      return (
        (data as { detail?: string })?.detail ||
        "Validation error. Please check your input."
      );

    case 500:
      return "Server error. Please try again later.";

    default:
      return (
        (data as { error?: { message?: string } })?.error?.message ||
        (data as { detail?: string })?.detail ||
        (data as { message?: string })?.message ||
        "An unexpected error occurred."
      );
  }
}

// =====================================================
// API Helper Functions
// =====================================================

export async function apiGet<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const response = await apiClient.get<T>(url, { params });
  return response.data;
}

export async function apiPost<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await apiClient.post<T>(url, data, config);
  return response.data;
}

export async function apiPut<T>(url: string, data?: unknown): Promise<T> {
  const response = await apiClient.put<T>(url, data);
  return response.data;
}

export async function apiPatch<T>(url: string, data?: unknown): Promise<T> {
  const response = await apiClient.patch<T>(url, data);
  return response.data;
}

export async function apiDelete<T = void>(url: string): Promise<T> {
  const response = await apiClient.delete<T>(url);
  return response.data;
}

// For file uploads — uses native fetch, NOT the axios instance.
// Axios's global "Content-Type: application/json" header fights FormData
// boundary generation no matter how we try to override it. Native fetch
// simply omits Content-Type when given a FormData body, letting the browser
// set the correct "multipart/form-data; boundary=..." automatically.
export async function apiUpload<T>(
  url: string,
  file: File,
  fieldName: string = "file",
  additionalData?: Record<string, string>,
): Promise<T> {
  const formData = new FormData();
  formData.append(fieldName, file);

  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, String(value));
    });
  }

  const token = tokenManager.getAccessToken();
  const branchId = tokenManager.getCurrentBranchId();

  const headers: HeadersInit = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (branchId) headers["X-Branch-ID"] = branchId;
  // Do NOT set Content-Type. Browser sets it with the correct boundary.

  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Invalid request: ${JSON.stringify(errorData)}`
    );
  }

  return response.json() as Promise<T>;
}


// For file downloads
export async function apiDownload(
  url: string,
  filename: string,
): Promise<void> {
  const response = await apiClient.get(url, {
    responseType: "blob",
  });

  const blob = new Blob([response.data]);
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

export default apiClient;
