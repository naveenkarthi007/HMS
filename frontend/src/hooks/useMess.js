import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { messApi } from '../api/mess';
import { useResourceMutation } from './useResourceMutation';

export const useMessMonth = (params, options = {}) =>
  useQuery({
    queryKey: ['mess', params],
    queryFn: () => messApi.month(params),
    placeholderData: keepPreviousData,
    ...options,
  });

export const useSaveMenu = () =>
  useResourceMutation(({ hostelId, date, ...body }) => messApi.save(hostelId, date, body), ['mess']);
export const useDeleteMenu = () =>
  useResourceMutation(({ hostelId, date }) => messApi.remove(hostelId, date), ['mess']);
