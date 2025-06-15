import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { z } from 'zod';

export const session_getSession_inputSchema = z.object({
  token: z.string(),
  others: z.record(z.any()).optional(),
});
export const session_getSession_outputSchema = z.object({
  entity: z.record(z.any()),
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
});

export const session_logout_inputSchema = z.object({
  token: z.string(),
  others: z.record(z.any()).optional(),
});
export const session_logout_outputSchema = z.object({
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
});

export const session_logoutAll_inputSchema = z.object({
  token: z.string(),
  others: z.record(z.any()).optional(),
});
export const session_logoutAll_outputSchema = z.object({
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
});

export const createSessionEndpoints = (
  api: AxiosInstance,
  getToken: () => string | null,
  config: any,
) => ({
  getSession: async (
    payload: z.infer<typeof session_getSession_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (
        data: z.infer<typeof session_getSession_outputSchema>,
      ) => void;
      onError?: (error: any) => void;
      interceptors?: {
        request?: (config: AxiosRequestConfig) => any;
        response?: (response: AxiosResponse) => any;
      };
    },
  ) => {
    callbacks?.onRequest?.();
    try {
      session_getSession_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/session/getSession',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = session_getSession_outputSchema.parse(
        processedResponse.data,
      );
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error: any) {
      callbacks?.onError?.(error.response?.data || error.message);
      return { data: null, error: error.response?.data || error.message };
    }
  },
  logout: async (
    payload: z.infer<typeof session_logout_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (data: z.infer<typeof session_logout_outputSchema>) => void;
      onError?: (error: any) => void;
      interceptors?: {
        request?: (config: AxiosRequestConfig) => any;
        response?: (response: AxiosResponse) => any;
      };
    },
  ) => {
    callbacks?.onRequest?.();
    try {
      session_logout_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/session/logout',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = session_logout_outputSchema.parse(processedResponse.data);
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error: any) {
      callbacks?.onError?.(error.response?.data || error.message);
      return { data: null, error: error.response?.data || error.message };
    }
  },
  logoutAll: async (
    payload: z.infer<typeof session_logoutAll_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (
        data: z.infer<typeof session_logoutAll_outputSchema>,
      ) => void;
      onError?: (error: any) => void;
      interceptors?: {
        request?: (config: AxiosRequestConfig) => any;
        response?: (response: AxiosResponse) => any;
      };
    },
  ) => {
    callbacks?.onRequest?.();
    try {
      session_logoutAll_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/session/logoutAll',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = session_logoutAll_outputSchema.parse(processedResponse.data);
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error: any) {
      callbacks?.onError?.(error.response?.data || error.message);
      return { data: null, error: error.response?.data || error.message };
    }
  },
});
