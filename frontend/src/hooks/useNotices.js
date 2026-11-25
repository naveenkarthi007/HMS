import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { noticesApi } from '../api/notices';
import { useResourceMutation } from './useResourceMutation';

const KEYS = ['notices'];

export const useNotices = (params) =>
  useQuery({
    queryKey: ['notices', params],
    queryFn: () => noticesApi.list(params),
    placeholderData: keepPreviousData,
  });

export const useCreateNotice = () => useResourceMutation(noticesApi.create, KEYS);
export const useUpdateNotice = () => useResourceMutation(({ id, ...body }) => noticesApi.update(id, body), KEYS);
export const useDeleteNotice = () => useResourceMutation((id) => noticesApi.remove(id), KEYS);
