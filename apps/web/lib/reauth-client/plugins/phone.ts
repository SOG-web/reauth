import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { z } from 'zod';

export const phone_login_inputSchema = z.object({
  password: z.string(),
  phone: z.string(),
  others: z.record(z.any()).optional(),
});
export const phone_login_outputSchema = z.object({
  entity: z.record(z.any()),
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
  token: z.string(),
});

export const phone_register_inputSchema = z.object({
  password: z.string(),
  phone: z.string(),
  others: z.record(z.any()).optional(),
});
export const phone_register_outputSchema = z.object({
  entity: z.record(z.any()),
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
  token: z.string(),
});

export const phone_verify_phone_inputSchema = z.object({
  code: z.string(),
  phone: z.string(),
  others: z.record(z.any()).optional(),
});
export const phone_verify_phone_outputSchema = z.object({
  entity: z.record(z.any()),
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
  token: z.string(),
});

export const phone_password_reset_inputSchema = z.object({
  phone: z.string(),
  others: z.record(z.any()).optional(),
});
export const phone_password_reset_outputSchema = z.object({
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
});

export const createPhoneEndpoints = (
  api: AxiosInstance,
  getToken: () => string | null,
  config: any,
) => ({
  login: async (
    payload: z.infer<typeof phone_login_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (data: z.infer<typeof phone_login_outputSchema>) => void;
      onError?: (error: any) => void;
      interceptors?: {
        request?: (config: AxiosRequestConfig) => any;
        response?: (response: AxiosResponse) => any;
      };
    },
  ) => {
    callbacks?.onRequest?.();
    try {
      phone_login_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/phone/login',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = phone_login_outputSchema.parse(processedResponse.data);
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error: any) {
      callbacks?.onError?.(error.response?.data || error.message);
      return { data: null, error: error.response?.data || error.message };
    }
  },
  register: async (
    payload: z.infer<typeof phone_register_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (data: z.infer<typeof phone_register_outputSchema>) => void;
      onError?: (error: any) => void;
      interceptors?: {
        request?: (config: AxiosRequestConfig) => any;
        response?: (response: AxiosResponse) => any;
      };
    },
  ) => {
    callbacks?.onRequest?.();
    try {
      phone_register_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/phone/register',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = phone_register_outputSchema.parse(processedResponse.data);
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error: any) {
      callbacks?.onError?.(error.response?.data || error.message);
      return { data: null, error: error.response?.data || error.message };
    }
  },
  verify_phone: async (
    payload: z.infer<typeof phone_verify_phone_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (
        data: z.infer<typeof phone_verify_phone_outputSchema>,
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
      phone_verify_phone_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/phone/verify-phone',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = phone_verify_phone_outputSchema.parse(
        processedResponse.data,
      );
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error: any) {
      callbacks?.onError?.(error.response?.data || error.message);
      return { data: null, error: error.response?.data || error.message };
    }
  },
  password_reset: async (
    payload: z.infer<typeof phone_password_reset_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (
        data: z.infer<typeof phone_password_reset_outputSchema>,
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
      phone_password_reset_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/phone/password-reset',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = phone_password_reset_outputSchema.parse(
        processedResponse.data,
      );
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error: any) {
      callbacks?.onError?.(error.response?.data || error.message);
      return { data: null, error: error.response?.data || error.message };
    }
  },
});
