import api, { cleanParams, unwrap, unwrapData } from './client';

export const complaintsApi = {
  list: (params) => unwrap(api.get('/complaints', { params: cleanParams(params) })),
  get: (id) => unwrapData(api.get(`/complaints/${id}`)),
  create: (body) => unwrapData(api.post('/complaints', body)),
  update: (id, body) => unwrapData(api.patch(`/complaints/${id}`, body)),
};
