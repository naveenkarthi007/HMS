import api, { cleanParams, unwrap, unwrapData } from './client';

export const hostelsApi = {
  list: (params) => unwrap(api.get('/hostels', { params: cleanParams(params) })),
  get: (id) => unwrapData(api.get(`/hostels/${id}`)),
  rooms: (id, params) => unwrap(api.get(`/hostels/${id}/rooms`, { params: cleanParams(params) })),
  create: (body) => unwrapData(api.post('/hostels', body)),
  update: (id, body) => unwrapData(api.patch(`/hostels/${id}`, body)),
  remove: (id) => unwrapData(api.delete(`/hostels/${id}`)),
};
