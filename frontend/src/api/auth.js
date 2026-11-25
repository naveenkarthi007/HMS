import api, { unwrapData } from './client';

export const authApi = {
  login: (credentials) => unwrapData(api.post('/auth/login', credentials)),
  logout: () => unwrapData(api.post('/auth/logout')),
  me: () => unwrapData(api.get('/auth/me')),
  changePassword: (body) => unwrapData(api.patch('/auth/password', body)),
};
