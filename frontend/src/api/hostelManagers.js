import api, { cleanParams, unwrap, unwrapData } from './client';

export const hostelManagersApi = {
  list: (params) => unwrap(api.get('/hostel-managers', { params: cleanParams(params) })),
  get: (id) => unwrapData(api.get(`/hostel-managers/${id}`)),
  create: (body) => unwrapData(api.post('/hostel-managers', body)),
  update: (id, body) => unwrapData(api.patch(`/hostel-managers/${id}`, body)),
  remove: (id) => unwrapData(api.delete(`/hostel-managers/${id}`)),
};
