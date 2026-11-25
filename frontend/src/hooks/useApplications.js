import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { applicationsApi } from '../api/applications';
import { useResourceMutation } from './useResourceMutation';

const KEYS = ['applications', 'students', 'allocations', 'rooms', 'hostels', 'dashboard'];

export const useApplications = (params) =>
  useQuery({
    queryKey: ['applications', params],
    queryFn: () => applicationsApi.list(params),
    placeholderData: keepPreviousData,
  });

export const useApplicationOptions = () =>
  useQuery({ queryKey: ['applications', 'options'], queryFn: applicationsApi.options });

export const useCreateApplication = () => useResourceMutation(applicationsApi.create, KEYS);
export const useCancelApplication = () => useResourceMutation((id) => applicationsApi.cancel(id), KEYS);
export const useReviewApplication = () =>
  useResourceMutation(({ id, ...body }) => applicationsApi.review(id, body), KEYS);
