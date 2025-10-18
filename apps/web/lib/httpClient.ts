/**
 * HTTP Client with Axios and Zod validation
 * Professional async API communication without manual timeouts
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import { API_CONFIG } from './constants';

/**
 * Custom API Error with status code and context
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
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
        const errorData = error.response.data as { error?: string } | undefined;
        throw new ApiError(
          errorData?.error || error.message,
          error.response.status,
          error,
        );
      } else if (error.request) {
        // Request made but no response
        throw new ApiError(
          'Network error - no response received',
          undefined,
          error,
        );
      } else {
        // Error in request setup
        throw new ApiError(error.message || 'Request failed', undefined, error);
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
