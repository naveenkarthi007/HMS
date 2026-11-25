import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { attendanceApi } from '../api/attendance';
import { useResourceMutation } from './useResourceMutation';

export const useAttendance = (params) =>
  useQuery({
    queryKey: ['attendance', params],
    queryFn: () => attendanceApi.list(params),
    placeholderData: keepPreviousData,
  });

export const useAttendanceSheet = (params) =>
  useQuery({
    queryKey: ['attendance', 'sheet', params],
    queryFn: () => attendanceApi.sheet(params),
    enabled: Boolean(params.hostelId && params.date),
  });

export const useMarkAttendance = () => useResourceMutation(attendanceApi.mark, ['attendance']);
