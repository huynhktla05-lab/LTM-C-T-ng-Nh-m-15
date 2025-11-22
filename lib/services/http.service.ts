import { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import axios from 'axios';
import _omitBy from 'lodash/omitBy';
import localStorageService from './localStorage.service';
import StoreKeys from '@/lib/constants/storeKeys';
import HttpStatusCode from '@/lib/constants/httpStatusCode';
import axiosConfig from '@/lib/configs/api.config';

export default class HttpService {
  private instance: AxiosInstance;

  constructor(config = axiosConfig) {
    const instance = axios.create({ ...config });
    Object.assign(instance, this.setupInterceptorsTo(instance));
    this.instance = instance;
  }

  private onRequest = async (config: AxiosRequestConfig) => {
    const token = localStorageService.get(StoreKeys.ACCESS_TOKEN, '');
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    config.withCredentials = true;
    return config;
  };

  private onRequestError = (error: AxiosError): Promise<AxiosError> => {
    console.error('[request error]', error);
    return Promise.reject(error);
  };

  private onResponse = (response: AxiosResponse) => response.data;

  private onResponseError = (error: AxiosError): Promise<AxiosError> => {
    const statusCode = error?.response?.status;
    if (statusCode === HttpStatusCode.UNAUTHORIZED) {
      if (typeof window !== 'undefined') window.location.replace('/signin');
    }
    return Promise.reject(error);
  };

  private setupInterceptorsTo(axiosInstance: AxiosInstance): AxiosInstance {
    axiosInstance.interceptors.request.use(this.onRequest, this.onRequestError);
    axiosInstance.interceptors.response.use(this.onResponse, this.onResponseError);
    return axiosInstance;
  }

  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.get<T>(url.startsWith('/') ? url : `/${url}`, config) as Promise<T>;
  }

  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.post<T>(url.startsWith('/') ? url : `/${url}`, data, config) as Promise<T>;
  }

  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.instance.put<T>(url.startsWith('/') ? url : `/${url}`, data, config);
  }

  public async patch<T>(url: string, data: any, config?: AxiosRequestConfig) {
    return this.instance.patch<T>(url.startsWith('/') ? url : `/${url}`, data, config);
  }

  public async delete(url: string, config?: AxiosRequestConfig) {
    return this.instance.delete(url.startsWith('/') ? url : `/${url}`, config);
  }

  public setHttpConfigs(config?: Partial<AxiosRequestConfig>) {
    if (config?.baseURL) this.instance.defaults.baseURL = config.baseURL;
    this.instance.defaults = { ...this.instance.defaults, ..._omitBy(config, 'BaseURL') };
  }
}
