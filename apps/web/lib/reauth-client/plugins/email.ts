import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { z } from 'zod';

export const email_login_inputSchema = z.object({
  email: z
    .string()
    .email()
    .regex(new RegExp('^[\\w%+.-]+@[\\d.A-Za-z-]+\\.[A-Za-z]{2,}$')),
  password: z.string(),
  others: z.record(z.any()).optional(),
});
export const email_login_outputSchema = z.object({
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
  entity: z.record(z.any()).optional(),
  error: z.union([z.record(z.any()), z.string()]).optional(),
  token: z.string().optional(),
});

export const email_register_inputSchema = z.object({
  email: z
    .string()
    .email()
    .regex(new RegExp('^[\\w%+.-]+@[\\d.A-Za-z-]+\\.[A-Za-z]{2,}$')),
  password: z.string(),
  others: z.record(z.any()).optional(),
});
export const email_register_outputSchema = z.any();

export const email_verify_email_inputSchema = z.object({
  code: z.union([
    z.string(),
    z.number().gte(-9007199254740991).lte(9007199254740991),
  ]),
  email: z
    .string()
    .email()
    .regex(new RegExp('^[\\w%+.-]+@[\\d.A-Za-z-]+\\.[A-Za-z]{2,}$')),
  others: z.record(z.any()).optional(),
});
export const email_verify_email_outputSchema = z.object({
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
});

export const email_resend_verify_email_inputSchema = z.object({
  email: z
    .string()
    .email()
    .regex(new RegExp('^[\\w%+.-]+@[\\d.A-Za-z-]+\\.[A-Za-z]{2,}$')),
  others: z.record(z.any()).optional(),
});
export const email_resend_verify_email_outputSchema = z.object({
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
});

export const email_send_reset_password_inputSchema = z.object({
  email: z
    .string()
    .email()
    .regex(new RegExp('^[\\w%+.-]+@[\\d.A-Za-z-]+\\.[A-Za-z]{2,}$')),
  others: z.record(z.any()).optional(),
});
export const email_send_reset_password_outputSchema = z.object({
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
});

export const email_reset_password_inputSchema = z.object({
  code: z.union([
    z.string(),
    z.number().gte(-9007199254740991).lte(9007199254740991),
  ]),
  email: z
    .string()
    .email()
    .regex(new RegExp('^[\\w%+.-]+@[\\d.A-Za-z-]+\\.[A-Za-z]{2,}$')),
  password: z.string(),
  others: z.record(z.any()).optional(),
});
export const email_reset_password_outputSchema = z.object({
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
});

export const createEmailEndpoints = (
  api: AxiosInstance,
  getToken: () => string | null,
  config: any,
) => ({
  login: async (
    payload: z.infer<typeof email_login_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (data: z.infer<typeof email_login_outputSchema>) => void;
      onError?: (error: any) => void;
      interceptors?: {
        request?: (config: AxiosRequestConfig) => any;
        response?: (response: AxiosResponse) => any;
      };
    },
  ) => {
    callbacks?.onRequest?.();
    try {
      email_login_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/email/login',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = email_login_outputSchema.parse(processedResponse.data);
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error: any) {
      callbacks?.onError?.(error.response?.data || error.message);
      return { data: null, error: error.response?.data || error.message };
    }
  },
  register: async (
    payload: z.infer<typeof email_register_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (data: z.infer<typeof email_register_outputSchema>) => void;
      onError?: (error: any) => void;
      interceptors?: {
        request?: (config: AxiosRequestConfig) => any;
        response?: (response: AxiosResponse) => any;
      };
    },
  ) => {
    callbacks?.onRequest?.();
    try {
      email_register_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/email/register',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = email_register_outputSchema.parse(processedResponse.data);
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error: any) {
      callbacks?.onError?.(error.response?.data || error.message);
      return { data: null, error: error.response?.data || error.message };
    }
  },
  verify_email: async (
    payload: z.infer<typeof email_verify_email_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (
        data: z.infer<typeof email_verify_email_outputSchema>,
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
      email_verify_email_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/email/verify-email',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = email_verify_email_outputSchema.parse(
        processedResponse.data,
      );
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error: any) {
      callbacks?.onError?.(error.response?.data || error.message);
      return { data: null, error: error.response?.data || error.message };
    }
  },
  resend_verify_email: async (
    payload: z.infer<typeof email_resend_verify_email_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (
        data: z.infer<typeof email_resend_verify_email_outputSchema>,
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
      email_resend_verify_email_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/email/resend-verify-email',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = email_resend_verify_email_outputSchema.parse(
        processedResponse.data,
      );
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error: any) {
      callbacks?.onError?.(error.response?.data || error.message);
      return { data: null, error: error.response?.data || error.message };
    }
  },
  send_reset_password: async (
    payload: z.infer<typeof email_send_reset_password_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (
        data: z.infer<typeof email_send_reset_password_outputSchema>,
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
      email_send_reset_password_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/email/send-reset-password',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = email_send_reset_password_outputSchema.parse(
        processedResponse.data,
      );
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error: any) {
      callbacks?.onError?.(error.response?.data || error.message);
      return { data: null, error: error.response?.data || error.message };
    }
  },
  reset_password: async (
    payload: z.infer<typeof email_reset_password_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (
        data: z.infer<typeof email_reset_password_outputSchema>,
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
      email_reset_password_inputSchema.parse(payload);

      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const token = getToken();
      if (token) {
        requestConfig.headers = {
          ...requestConfig.headers,
          Authorization: `Bearer ${token}`,
        };
      }
      const response = await api.post(
        '/auth/email/reset-password',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = email_reset_password_outputSchema.parse(
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
