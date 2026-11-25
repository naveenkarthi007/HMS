import api, { cleanParams, unwrap, unwrapData } from './client';

export const outingsApi = {
  list: (params) => unwrap(api.get('/outings', { params: cleanParams(params) })),
  create: (body) => unwrapData(api.post('/outings', body)),
  review: (id, body) => unwrapData(api.post(`/outings/${id}/review`, body)),
  checkOut: (id) => unwrapData(api.post(`/outings/${id}/check-out`)),
  checkIn: (id) => unwrapData(api.post(`/outings/${id}/check-in`)),
  cancel: (id) => unwrapData(api.post(`/outings/${id}/cancel`)),
};
