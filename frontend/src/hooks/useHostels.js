import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { hostelsApi } from '../api/hostels';
import { useResourceMutation } from './useResourceMutation';

const KEYS = ['hostels', 'rooms', 'dashboard'];

export const useHostels = (params, options = {}) =>
  useQuery({
    queryKey: ['hostels', params],
    queryFn: () => hostelsApi.list(params),
    placeholderData: keepPreviousData,
    ...options,
  });

/** All hostels the user can see (optionally of one gender) for dropdowns. */
export function useHostelOptions(gender, extra = {}, options = {}) {
  const query = useHostels({ limit: 100, gender: gender || undefined, ...extra }, options);
  const hostels = query.data?.data ?? [];
  return {
    ...query,
    hostels,
    options: hostels.map((h) => ({ value: String(h.id), label: `${h.name} (${h.gender === 'male' ? 'M' : 'F'})` })),
  };
}

export const useHostel = (id) =>
  useQuery({ queryKey: ['hostels', 'detail', id], queryFn: () => hostelsApi.get(id), enabled: Boolean(id) });

export const useCreateHostel = () => useResourceMutation(hostelsApi.create, KEYS);
export const useUpdateHostel = () => useResourceMutation(({ id, ...body }) => hostelsApi.update(id, body), KEYS);
export const useDeleteHostel = () => useResourceMutation((id) => hostelsApi.remove(id), KEYS);
