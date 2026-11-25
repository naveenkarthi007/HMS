import api, { cleanParams, unwrap, unwrapData } from './client';

export const leavesApi = {
  list: (params) => unwrap(api.get('/leaves', { params: cleanParams(params) })),
  get: (id) => unwrapData(api.get(`/leaves/${id}`)),
  create: (body) => unwrapData(api.post('/leaves', body)),
  review: (id, body) => unwrapData(api.post(`/leaves/${id}/review`, body)),
  cancel: (id) => unwrapData(api.delete(`/leaves/${id}`)),
};
