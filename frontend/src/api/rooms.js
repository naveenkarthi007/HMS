import api, { cleanParams, unwrap, unwrapData } from './client';

export const roomsApi = {
  list: (params) => unwrap(api.get('/rooms', { params: cleanParams(params) })),
  get: (id) => unwrapData(api.get(`/rooms/${id}`)),
  create: (body) => unwrapData(api.post('/rooms', body)),
  update: (id, body) => unwrapData(api.patch(`/rooms/${id}`, body)),
  remove: (id) => unwrapData(api.delete(`/rooms/${id}`)),
};
