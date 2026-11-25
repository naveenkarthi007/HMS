import api, { cleanParams, unwrap, unwrapData } from './client';

export const allocationsApi = {
  list: (params) => unwrap(api.get('/allocations', { params: cleanParams(params) })),
  get: (id) => unwrapData(api.get(`/allocations/${id}`)),
  create: (body) => unwrapData(api.post('/allocations', body)),
  vacate: (id, body) => unwrapData(api.post(`/allocations/${id}/vacate`, body)),
};
