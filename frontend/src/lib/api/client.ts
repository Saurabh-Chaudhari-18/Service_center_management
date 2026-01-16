/**
 * API Client with JWT authentication and request/response interceptors
 */
import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";

// API Base URL - configurable via environment
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001/api";

// Token storage keys
const ACCESS_TOKEN_KEY = "scm_access_token";
const REFRESH_TOKEN_KEY = "scm_refresh_token";
const CURRENT_BRANCH_KEY = "scm_current_branch";

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 seconds
});

// =====================================================
// Token Management
// =====================================================

export const tokenManager = {
  getAccessToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  setTokens: (access: string, refresh: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },

  clearTokens: (): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(CURRENT_BRANCH_KEY);
  },

  getCurrentBranchId: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(CURRENT_BRANCH_KEY);
  },

  setCurrentBranchId: (branchId: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(CURRENT_BRANCH_KEY, branchId);
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
  }
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
          {
            refresh: refreshToken,
          }
        );

        const { access } = response.data;
        localStorage.setItem(ACCESS_TOKEN_KEY, access);

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
  }
);

// =====================================================
// Error Message Formatter
// =====================================================

function formatErrorMessage(error: AxiosError<unknown>): string {
  if (!error.response) {
    if (error.code === "ECONNABORTED") {
      return "Request timed out. Please try again.";
    }
    return "Network error. Please check your connection.";
  }

  const { status, data } = error.response;

  // Handle specific status codes
  switch (status) {
    case 400:
      // Validation errors
      if (typeof data === "object" && data !== null) {
        const errors: string[] = [];
        Object.entries(data).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            errors.push(`${key}: ${value.join(", ")}`);
          } else if (typeof value === "string") {
            errors.push(`${key}: ${value}`);
          }
        });
        if (errors.length > 0) {
          return errors.join("\n");
        }
      }
      return "Invalid request. Please check your input.";

    case 401:
      return "Authentication required. Please login again.";

    case 403:
      return "You do not have permission to perform this action.";

    case 404:
      return "The requested resource was not found.";

    case 409:
      return (
        (data as { detail?: string })?.detail ||
        "Conflict error. The resource may already exist."
      );

    case 422:
      return (
        (data as { detail?: string })?.detail ||
        "Validation error. Please check your input."
      );

    case 500:
      return "Server error. Please try again later.";

    default:
      return (
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
  params?: Record<string, unknown>
): Promise<T> {
  const response = await apiClient.get<T>(url, { params });
  return response.data;
}

export async function apiPost<T>(url: string, data?: unknown): Promise<T> {
  const response = await apiClient.post<T>(url, data);
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

// For file uploads
export async function apiUpload<T>(
  url: string,
  file: File,
  fieldName: string = "file",
  additionalData?: Record<string, string>
): Promise<T> {
  const formData = new FormData();
  formData.append(fieldName, file);

  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }

  const response = await apiClient.post<T>(url, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
}

// For file downloads
export async function apiDownload(
  url: string,
  filename: string
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
