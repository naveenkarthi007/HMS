import api, { cleanParams, unwrap, unwrapData } from './client';

export const organisationsApi = {
  list: (params) => unwrap(api.get('/organisations', { params: cleanParams(params) })),
  get: (id) => unwrapData(api.get(`/organisations/${id}`)),
  create: (body) => unwrapData(api.post('/organisations', body)),
  update: (id, body) => unwrapData(api.patch(`/organisations/${id}`, body)),
  remove: (id) => unwrapData(api.delete(`/organisations/${id}`)),
  listAdmins: (id) => unwrapData(api.get(`/organisations/${id}/admins`)),
  createAdmin: (id, body) => unwrapData(api.post(`/organisations/${id}/admins`, body)),
  updateAdmin: (id, adminId, body) => unwrapData(api.patch(`/organisations/${id}/admins/${adminId}`, body)),
};
