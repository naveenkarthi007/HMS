import api, { cleanParams, unwrapData } from './client';

export const messApi = {
  month: (params) => unwrapData(api.get('/mess', { params: cleanParams(params) })),
  save: (hostelId, date, body) => unwrapData(api.put(`/mess/${hostelId}/${date}`, body)),
  remove: (hostelId, date) => unwrapData(api.delete(`/mess/${hostelId}/${date}`)),
};
