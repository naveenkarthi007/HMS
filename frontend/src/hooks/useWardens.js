import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { wardensApi } from '../api/wardens';
import { useResourceMutation } from './useResourceMutation';

const KEYS = ['wardens', 'hostels'];

export const useWardens = (params, options = {}) =>
  useQuery({
    queryKey: ['wardens', params],
    queryFn: () => wardensApi.list(params),
    placeholderData: keepPreviousData,
    ...options,
  });

export const useCreateWarden = () => useResourceMutation(wardensApi.create, KEYS);
export const useUpdateWarden = () => useResourceMutation(({ id, ...body }) => wardensApi.update(id, body), KEYS);
export const useAssignWardenHostels = () =>
  useResourceMutation(({ id, ...payload }) => wardensApi.assignHostels(id, payload), KEYS);
export const useDeleteWarden = () => useResourceMutation((id) => wardensApi.remove(id), KEYS);
