import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { allocationsApi } from '../api/allocations';
import { useResourceMutation } from './useResourceMutation';

const KEYS = ['allocations', 'students', 'rooms', 'hostels', 'dashboard'];

export const useAllocations = (params) =>
  useQuery({
    queryKey: ['allocations', params],
    queryFn: () => allocationsApi.list(params),
    placeholderData: keepPreviousData,
  });

export const useCreateAllocation = () => useResourceMutation(allocationsApi.create, KEYS);
export const useVacateAllocation = () =>
  useResourceMutation(({ id, ...body }) => allocationsApi.vacate(id, body), KEYS);
