import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { leavesApi } from '../api/leaves';
import { useResourceMutation } from './useResourceMutation';

const KEYS = ['leaves', 'dashboard', 'attendance'];

export const useLeaves = (params) =>
  useQuery({
    queryKey: ['leaves', params],
    queryFn: () => leavesApi.list(params),
    placeholderData: keepPreviousData,
  });

export const useCreateLeave = () => useResourceMutation(leavesApi.create, KEYS);
export const useReviewLeave = () => useResourceMutation(({ id, ...body }) => leavesApi.review(id, body), KEYS);
export const useCancelLeave = () => useResourceMutation((id) => leavesApi.cancel(id), KEYS);
