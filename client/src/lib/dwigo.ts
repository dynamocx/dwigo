import type { AxiosRequestConfig, AxiosResponse } from 'axios';

import api from '@/api/client';

export interface DwigoError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface DwigoMeta {
  recommended_by?: string | null;
  [key: string]: unknown;
}

export interface DwigoEnvelope<T> {
  data: T;
  error: DwigoError | null;
  meta: DwigoMeta;
}

type RequestMethod = 'get' | 'delete';
type MutationMethod = 'post' | 'put' | 'patch';

const request = async <T>(
  method: RequestMethod,
  url: string,
  config?: AxiosRequestConfig
): Promise<DwigoEnvelope<T>> => {
  const response: AxiosResponse<DwigoEnvelope<T>> = await api.request({
    method,
    url,
    ...config,
  });

  return response.data;
};

const mutate = async <TBody, TResult>(
  method: MutationMethod,
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig
): Promise<DwigoEnvelope<TResult>> => {
  const response: AxiosResponse<DwigoEnvelope<TResult>> = await api.request({
    method,
    url,
    data: body,
    ...config,
  });

  return response.data;
};

export const dwigo = {
  get: <T>(url: string, config?: AxiosRequestConfig) => request<T>('get', url, config),
  delete: <T>(url: string, config?: AxiosRequestConfig) => request<T>('delete', url, config),
  post: <TBody, TResult>(url: string, body?: TBody, config?: AxiosRequestConfig) =>
    mutate<TBody, TResult>('post', url, body, config),
  put: <TBody, TResult>(url: string, body?: TBody, config?: AxiosRequestConfig) =>
    mutate<TBody, TResult>('put', url, body, config),
  patch: <TBody, TResult>(url: string, body?: TBody, config?: AxiosRequestConfig) =>
    mutate<TBody, TResult>('patch', url, body, config),
};

export type DwigoClient = typeof dwigo;


