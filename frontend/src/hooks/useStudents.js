import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { studentsApi } from '../api/students';
import { useResourceMutation } from './useResourceMutation';

const KEYS = ['students', 'dashboard'];

export const useStudents = (params, options = {}) =>
  useQuery({
    queryKey: ['students', params],
    queryFn: () => studentsApi.list(params),
    placeholderData: keepPreviousData,
    ...options,
  });

export const useStudent = (id) =>
  useQuery({ queryKey: ['students', 'detail', id], queryFn: () => studentsApi.get(id), enabled: Boolean(id) });

export const useMyProfile = () => useQuery({ queryKey: ['students', 'me'], queryFn: studentsApi.me });

export const useUpdateMyProfile = () => useResourceMutation(studentsApi.updateMe, ['students']);
export const useCreateStudent = () => useResourceMutation(studentsApi.create, KEYS);
export const useUpdateStudent = () => useResourceMutation(({ id, ...body }) => studentsApi.update(id, body), KEYS);
export const useDeleteStudent = () => useResourceMutation((id) => studentsApi.remove(id), KEYS);
