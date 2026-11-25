import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';

export const useDashboardSummary = (params) =>
  useQuery({
    queryKey: ['dashboard', params],
    queryFn: () => dashboardApi.summary(params),
    placeholderData: keepPreviousData,
  });

export const usePlatformOverview = () =>
  useQuery({ queryKey: ['dashboard', 'platform'], queryFn: dashboardApi.platform });
