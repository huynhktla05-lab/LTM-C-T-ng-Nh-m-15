'use client';

import { RegisterRequest, AuthUserResponse, User, LoginRequest } from './user.types';
import HttpService from '@/lib/services/http.service';
import localStorageService from '@/lib/services/localStorage.service';
import StoreKeys from '@/lib/constants/storeKeys';

class UserApiService extends HttpService {
  register(data: RegisterRequest) {
    return this.post<AuthUserResponse>('/users/register', data).then(res => {
      localStorageService.set(StoreKeys.ACCESS_TOKEN, res.token);
      return res;
    });
  }

  login(data: LoginRequest) {
    return this.post<AuthUserResponse>('/users/login', data).then(res => {
      localStorageService.set(StoreKeys.ACCESS_TOKEN, res.token);
      return res;
    });
  }

  getUserById(id: string) {
    return this.get<User>(`/users/${id}`);
  }

  getUsers() {
    return this.get<User[]>('/users');
  }

  checkAuthorization() {
    return this.get<User>('/users/check-authorization');
  }
}

const userApi = new UserApiService();
export default userApi;
