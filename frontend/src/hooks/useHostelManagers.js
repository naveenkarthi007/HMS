import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { hostelManagersApi } from '../api/hostelManagers';
import { useResourceMutation } from './useResourceMutation';

const KEYS = ['hostel-managers'];

export const useHostelManagers = (params, options = {}) =>
  useQuery({
    queryKey: ['hostel-managers', params],
    queryFn: () => hostelManagersApi.list(params),
    placeholderData: keepPreviousData,
    ...options,
  });

export const useCreateHostelManager = () => useResourceMutation(hostelManagersApi.create, KEYS);
export const useUpdateHostelManager = () =>
  useResourceMutation(({ id, ...body }) => hostelManagersApi.update(id, body), KEYS);
export const useDeleteHostelManager = () => useResourceMutation((id) => hostelManagersApi.remove(id), KEYS);
