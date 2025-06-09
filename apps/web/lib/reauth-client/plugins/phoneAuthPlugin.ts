import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { z } from 'zod';

export const phoneAuthPlugin_login_inputSchema = z.object({
  password: z
    .string()
    .regex(
      new RegExp(
        '^(?=.*[a-z])(?=.*[A-Z])(?=.*d)(?=.*[@$!%*?&])[A-Za-zd@$!%*?&]{8,}$',
      ),
    ),
  phone: z.string().regex(new RegExp('^\\+?[1-9]\\d{1,14}$')),
});
export const phoneAuthPlugin_login_outputSchema = z.object({
  entity: z.record(z.any()),
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
  token: z.string(),
});

export const phoneAuthPlugin_register_inputSchema = z.object({
  password: z
    .string()
    .regex(
      new RegExp(
        '^(?=.*[a-z])(?=.*[A-Z])(?=.*d)(?=.*[@$!%*?&])[A-Za-zd@$!%*?&]{8,}$',
      ),
    ),
  phone: z.string().regex(new RegExp('^\\+?[1-9]\\d{1,14}$')),
});
export const phoneAuthPlugin_register_outputSchema = z.object({
  entity: z.record(z.any()),
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
  token: z.string(),
});

export const phoneAuthPlugin_verify_phone_inputSchema = z.object({
  code: z.string(),
  phone: z.string().regex(new RegExp('^\\+?[1-9]\\d{1,14}$')),
});
export const phoneAuthPlugin_verify_phone_outputSchema = z.object({
  entity: z.record(z.any()),
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
  token: z.string(),
});

export const phoneAuthPlugin_password_reset_inputSchema = z.object({
  phone: z.string().regex(new RegExp('^\\+?[1-9]\\d{1,14}$')),
});
export const phoneAuthPlugin_password_reset_outputSchema = z.object({
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
});

export const createPhoneAuthPluginEndpoints = (
  api: AxiosInstance,
  getToken: () => string | null,
  config: any,
) => ({
  login: async (
    payload: z.infer<typeof phoneAuthPlugin_login_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (
        data: z.infer<typeof phoneAuthPlugin_login_outputSchema>,
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
      phoneAuthPlugin_login_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/phoneAuthPlugin/login',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = phoneAuthPlugin_login_outputSchema.parse(
        processedResponse.data.data,
      );
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error) {
      callbacks?.onError?.(error);
      return { data: null, error };
    }
  },
  register: async (
    payload: z.infer<typeof phoneAuthPlugin_register_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (
        data: z.infer<typeof phoneAuthPlugin_register_outputSchema>,
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
      phoneAuthPlugin_register_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/phoneAuthPlugin/register',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = phoneAuthPlugin_register_outputSchema.parse(
        processedResponse.data.data,
      );
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error) {
      callbacks?.onError?.(error);
      return { data: null, error };
    }
  },
  verify_phone: async (
    payload: z.infer<typeof phoneAuthPlugin_verify_phone_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (
        data: z.infer<typeof phoneAuthPlugin_verify_phone_outputSchema>,
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
      phoneAuthPlugin_verify_phone_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/phoneAuthPlugin/verify-phone',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = phoneAuthPlugin_verify_phone_outputSchema.parse(
        processedResponse.data.data,
      );
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error) {
      callbacks?.onError?.(error);
      return { data: null, error };
    }
  },
  password_reset: async (
    payload: z.infer<typeof phoneAuthPlugin_password_reset_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (
        data: z.infer<typeof phoneAuthPlugin_password_reset_outputSchema>,
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
      phoneAuthPlugin_password_reset_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/phoneAuthPlugin/password-reset',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = phoneAuthPlugin_password_reset_outputSchema.parse(
        processedResponse.data.data,
      );
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error) {
      callbacks?.onError?.(error);
      return { data: null, error };
    }
  },
});
