import api, { cleanParams, unwrap, unwrapData } from './client';

export const attendanceApi = {
  list: (params) => unwrap(api.get('/attendance', { params: cleanParams(params) })),
  sheet: (params) => unwrapData(api.get('/attendance/sheet', { params: cleanParams(params) })),
  mark: (body) => unwrapData(api.post('/attendance', body)),
};
