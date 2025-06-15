import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { createSessionEndpoints } from './plugins/session';
import { createEmailEndpoints } from './plugins/email';
import { createPhoneEndpoints } from './plugins/phone';

interface AuthClientConfig {
  baseURL?: string;
  axiosInstance?: AxiosInstance;
  axiosConfig?: AxiosRequestConfig;
  auth?: {
    type: 'localstorage' | 'sessionstorage' | 'cookie' | 'custom';
    key?: string;
    getToken?: () => string | null;
  };
}

export const createReAuthClient = (config: AuthClientConfig) => {
  if (!config.axiosInstance && !config.baseURL) {
    throw new Error(
      'Either baseURL or a pre-configured axiosInstance must be provided.',
    );
  }

  const api =
    config.axiosInstance ||
    axios.create({
      ...config.axiosConfig,
      baseURL: config.baseURL,
      withCredentials: config.auth?.type === 'cookie',
    });

  const getToken = (): string | null => {
    if (
      !config.auth ||
      typeof window === 'undefined' ||
      config.auth.type === 'cookie'
    )
      return null;
    const { type, key, getToken: customGetToken } = config.auth;
    switch (type) {
      case 'localstorage':
        return localStorage.getItem(key || 'reauth-token');
      case 'sessionstorage':
        return sessionStorage.getItem(key || 'reauth-token');
      case 'custom':
        return customGetToken ? customGetToken() : null;
      default:
        return null;
    }
  };

  const client = {
    session: createSessionEndpoints(api, getToken, config),
    email: createEmailEndpoints(api, getToken, config),
    phone: createPhoneEndpoints(api, getToken, config),
  };

  return {
    ...client,
    axiosInstance: api,
    interceptors: api.interceptors,
  };
};
