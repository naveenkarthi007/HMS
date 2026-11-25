import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { complaintsApi } from '../api/complaints';
import { useResourceMutation } from './useResourceMutation';

const KEYS = ['complaints', 'dashboard'];

export const useComplaints = (params) =>
  useQuery({
    queryKey: ['complaints', params],
    queryFn: () => complaintsApi.list(params),
    placeholderData: keepPreviousData,
  });

export const useCreateComplaint = () => useResourceMutation(complaintsApi.create, KEYS);
export const useUpdateComplaint = () => useResourceMutation(({ id, ...body }) => complaintsApi.update(id, body), KEYS);
