import api, { cleanParams, unwrap, unwrapData } from './client';

export const studentsApi = {
  list: (params) => unwrap(api.get('/students', { params: cleanParams(params) })),
  get: (id) => unwrapData(api.get(`/students/${id}`)),
  me: () => unwrapData(api.get('/students/me')),
  updateMe: (body) => unwrapData(api.patch('/students/me', body)),
  create: (body) => unwrapData(api.post('/students', body)),
  update: (id, body) => unwrapData(api.patch(`/students/${id}`, body)),
  remove: (id) => unwrapData(api.delete(`/students/${id}`)),
};
