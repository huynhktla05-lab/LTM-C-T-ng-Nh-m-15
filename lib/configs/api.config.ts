import { AxiosRequestConfig } from 'axios';

// Cấu hình Axios theo môi trường
const axiosConfigs = {
  development: {
    baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`, // dev local
    withCredentials: true, // nếu backend dùng cookie
    timeout: 10000,
  },
  production: {
    baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`, // domain production
    withCredentials: true,
    timeout: 10000,
  },
  test: {
    baseURL: '/api',
    withCredentials: true,
    timeout: 10000,
  },
};

const getAxiosConfig = (): AxiosRequestConfig => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  return axiosConfigs[nodeEnv as keyof typeof axiosConfigs];
};

const axiosConfig = getAxiosConfig();

console.log('Axios baseURL:', axiosConfig.baseURL); // debug
export default axiosConfig;
