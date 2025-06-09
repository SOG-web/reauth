import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { z } from 'zod';

export const emailAuthPlugin_login_inputSchema = z.object({
  email: z
    .string()
    .email()
    .regex(new RegExp('^[\\w%+.-]+@[\\d.A-Za-z-]+\\.[A-Za-z]{2,}$')),
  password: z
    .string()
    .regex(
      new RegExp(
        '^(?=.*[a-z])(?=.*[A-Z])(?=.*d)(?=.*[@$!%*?&])[A-Za-zd@$!%*?&]{8,}$',
      ),
    ),
});
export const emailAuthPlugin_login_outputSchema = z.object({
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
  entity: z.record(z.any()).optional(),
  error: z.union([z.record(z.any()), z.string()]).optional(),
  token: z.string().optional(),
});

export const emailAuthPlugin_register_inputSchema = z.object({
  email: z
    .string()
    .email()
    .regex(new RegExp('^[\\w%+.-]+@[\\d.A-Za-z-]+\\.[A-Za-z]{2,}$')),
  password: z
    .string()
    .regex(
      new RegExp(
        '^(?=.*[a-z])(?=.*[A-Z])(?=.*d)(?=.*[@$!%*?&])[A-Za-zd@$!%*?&]{8,}$',
      ),
    ),
});
export const emailAuthPlugin_register_outputSchema = z.any();

export const emailAuthPlugin_verify_email_inputSchema = z.object({
  code: z.union([
    z.string(),
    z.number().gte(-9007199254740991).lte(9007199254740991),
  ]),
  email: z
    .string()
    .email()
    .regex(new RegExp('^[\\w%+.-]+@[\\d.A-Za-z-]+\\.[A-Za-z]{2,}$')),
});
export const emailAuthPlugin_verify_email_outputSchema = z.object({
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
});

export const emailAuthPlugin_resend_verify_email_inputSchema = z.object({
  email: z
    .string()
    .email()
    .regex(new RegExp('^[\\w%+.-]+@[\\d.A-Za-z-]+\\.[A-Za-z]{2,}$')),
});
export const emailAuthPlugin_resend_verify_email_outputSchema = z.object({
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
});

export const emailAuthPlugin_send_reset_password_inputSchema = z.object({
  email: z
    .string()
    .email()
    .regex(new RegExp('^[\\w%+.-]+@[\\d.A-Za-z-]+\\.[A-Za-z]{2,}$')),
});
export const emailAuthPlugin_send_reset_password_outputSchema = z.object({
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
});

export const emailAuthPlugin_reset_password_inputSchema = z.object({
  code: z.union([
    z.string(),
    z.number().gte(-9007199254740991).lte(9007199254740991),
  ]),
  email: z
    .string()
    .email()
    .regex(new RegExp('^[\\w%+.-]+@[\\d.A-Za-z-]+\\.[A-Za-z]{2,}$')),
  password: z
    .string()
    .regex(
      new RegExp(
        '^(?=.*[a-z])(?=.*[A-Z])(?=.*d)(?=.*[@$!%*?&])[A-Za-zd@$!%*?&]{8,}$',
      ),
    ),
});
export const emailAuthPlugin_reset_password_outputSchema = z.object({
  message: z.string(),
  status: z.string(),
  success: z.boolean(),
});

export const createEmailAuthPluginEndpoints = (
  api: AxiosInstance,
  getToken: () => string | null,
  config: any,
) => ({
  login: async (
    payload: z.infer<typeof emailAuthPlugin_login_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (
        data: z.infer<typeof emailAuthPlugin_login_outputSchema>,
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
      emailAuthPlugin_login_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/emailAuthPlugin/login',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = emailAuthPlugin_login_outputSchema.parse(
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
    payload: z.infer<typeof emailAuthPlugin_register_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (
        data: z.infer<typeof emailAuthPlugin_register_outputSchema>,
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
      emailAuthPlugin_register_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/emailAuthPlugin/register',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = emailAuthPlugin_register_outputSchema.parse(
        processedResponse.data.data,
      );
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error) {
      callbacks?.onError?.(error);
      return { data: null, error };
    }
  },
  verify_email: async (
    payload: z.infer<typeof emailAuthPlugin_verify_email_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (
        data: z.infer<typeof emailAuthPlugin_verify_email_outputSchema>,
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
      emailAuthPlugin_verify_email_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/emailAuthPlugin/verify-email',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = emailAuthPlugin_verify_email_outputSchema.parse(
        processedResponse.data.data,
      );
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error) {
      callbacks?.onError?.(error);
      return { data: null, error };
    }
  },
  resend_verify_email: async (
    payload: z.infer<typeof emailAuthPlugin_resend_verify_email_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (
        data: z.infer<typeof emailAuthPlugin_resend_verify_email_outputSchema>,
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
      emailAuthPlugin_resend_verify_email_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/emailAuthPlugin/resend-verify-email',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = emailAuthPlugin_resend_verify_email_outputSchema.parse(
        processedResponse.data.data,
      );
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error) {
      callbacks?.onError?.(error);
      return { data: null, error };
    }
  },
  send_reset_password: async (
    payload: z.infer<typeof emailAuthPlugin_send_reset_password_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (
        data: z.infer<typeof emailAuthPlugin_send_reset_password_outputSchema>,
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
      emailAuthPlugin_send_reset_password_inputSchema.parse(payload);
      const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
      if (callbacks?.interceptors?.request) {
        callbacks.interceptors.request(requestConfig);
      }
      const response = await api.post(
        '/auth/emailAuthPlugin/send-reset-password',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = emailAuthPlugin_send_reset_password_outputSchema.parse(
        processedResponse.data.data,
      );
      callbacks?.onSuccess?.(data);
      return { data, error: null };
    } catch (error) {
      callbacks?.onError?.(error);
      return { data: null, error };
    }
  },
  reset_password: async (
    payload: z.infer<typeof emailAuthPlugin_reset_password_inputSchema>,
    callbacks?: {
      onRequest?: () => void;
      onSuccess?: (
        data: z.infer<typeof emailAuthPlugin_reset_password_outputSchema>,
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
      emailAuthPlugin_reset_password_inputSchema.parse(payload);

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
        '/auth/emailAuthPlugin/reset-password',
        payload,
        requestConfig,
      );
      let processedResponse = response;
      if (callbacks?.interceptors?.response) {
        processedResponse = callbacks.interceptors.response(response);
      }
      const data = emailAuthPlugin_reset_password_outputSchema.parse(
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
