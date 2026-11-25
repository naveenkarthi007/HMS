import api, { cleanParams, unwrap, unwrapData } from './client';

export const wardensApi = {
  list: (params) => unwrap(api.get('/wardens', { params: cleanParams(params) })),
  get: (id) => unwrapData(api.get(`/wardens/${id}`)),
  create: (body) => unwrapData(api.post('/wardens', body)),
  update: (id, body) => unwrapData(api.patch(`/wardens/${id}`, body)),
  assignHostels: (id, payload) =>
    unwrapData(api.put(`/wardens/${id}/hostels`, Array.isArray(payload) ? { hostelIds: payload } : payload)),
  remove: (id) => unwrapData(api.delete(`/wardens/${id}`)),
};
