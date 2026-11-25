import api, { cleanParams, unwrap, unwrapData } from './client';

export const applicationsApi = {
  list: (params) => unwrap(api.get('/applications', { params: cleanParams(params) })),
  options: () => unwrapData(api.get('/applications/options')),
  create: (body) => unwrapData(api.post('/applications', body)),
  cancel: (id) => unwrapData(api.post(`/applications/${id}/cancel`)),
  review: (id, body) => unwrapData(api.post(`/applications/${id}/review`, body)),
};
