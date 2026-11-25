import api, { cleanParams, unwrap, unwrapData } from './client';

export const noticesApi = {
  list: (params) => unwrap(api.get('/notices', { params: cleanParams(params) })),
  get: (id) => unwrapData(api.get(`/notices/${id}`)),
  create: (body) => unwrapData(api.post('/notices', body)),
  update: (id, body) => unwrapData(api.patch(`/notices/${id}`, body)),
  remove: (id) => unwrapData(api.delete(`/notices/${id}`)),
};
