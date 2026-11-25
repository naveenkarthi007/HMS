import api, { cleanParams, unwrapData } from './client';

export const dashboardApi = {
  summary: (params) => unwrapData(api.get('/dashboard/summary', { params: cleanParams(params) })),
  platform: () => unwrapData(api.get('/dashboard/platform')),
};
