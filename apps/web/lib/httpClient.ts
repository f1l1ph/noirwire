/**
 * HTTP Client with Axios and error code handling
 * Provides professional async API communication with structured error responses
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import { API_CONFIG } from './constants';

/**
 * API Error Response structure
 */
export interface ApiErrorResponse {
  statusCode: number;
  errorCode?: string;
  message: string;
  userMessage?: string;
  timestamp?: string;
  requestId?: string;
  details?: Record<string, string | number | boolean>;
}

/**
 * Custom API Error with error code and context
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorCode?: string,
    public userMessage?: string,
    public details?: Record<string, string | number | boolean>,
    public originalError?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    return this.userMessage || this.message;
  }

  /**
   * Check if error is a specific error code
   */
  isErrorCode(code: string): boolean {
    return this.errorCode === code;
  }

  /**
   * Get error details
   */
  getDetails(): Record<string, string | number | boolean> | undefined {
    return this.details;
  }
}

/**
 * Create and configure axios instance with retry logic
 */
function createHttpClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_CONFIG.BASE_URL,
    timeout: API_CONFIG.TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Configure axios-retry plugin
  axiosRetry(client, {
    retries: API_CONFIG.RETRY_ATTEMPTS,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error: AxiosError) => {
      // Retry on network errors or 5xx server errors
      // But NOT on 4xx client errors (validation, not found, etc.)
      return (
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        (error.response?.status ?? 0) >= 500
      );
    },
    onRetry: (retryCount, error) => {
      console.log(`🔄 Retry attempt ${retryCount} for ${error.config?.url}`);
    },
  });

  // Request interceptor for logging
  client.interceptors.request.use(
    (config) => {
      console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    },
    (error) => {
      console.error('❌ Request error:', error);
      return Promise.reject(error);
    },
  );

  // Response interceptor for error transformation
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response) {
        // Server responded with error status
        const errorData = error.response.data as ApiErrorResponse | undefined;

        throw new ApiError(
          errorData?.message || error.message,
          error.response.status,
          errorData?.errorCode,
          errorData?.userMessage,
          errorData?.details,
          error,
        );
      } else if (error.request) {
        // Request made but no response
        throw new ApiError(
          'Network error - no response received',
          undefined,
          'NETWORK_ERROR',
          'Unable to reach the server. Please check your connection.',
          undefined,
          error,
        );
      } else {
        // Error in request setup
        throw new ApiError(
          error.message || 'Request failed',
          undefined,
          'REQUEST_ERROR',
          'Failed to prepare request.',
          undefined,
          error,
        );
      }
    },
  );

  return client;
}

/**
 * Singleton HTTP client instance
 */
export const httpClient = createHttpClient();

/**
 * Generic GET request
 */
export async function get<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await httpClient.get<T>(url, config);
  return response.data;
}

/**
 * Generic POST request
 */
export async function post<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await httpClient.post<T>(url, data, config);
  return response.data;
}
