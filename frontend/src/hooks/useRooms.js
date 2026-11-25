import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { roomsApi } from '../api/rooms';
import { hostelsApi } from '../api/hostels';
import { useResourceMutation } from './useResourceMutation';

const KEYS = ['rooms', 'hostels', 'dashboard'];

export const useRooms = (params, options = {}) =>
  useQuery({
    queryKey: ['rooms', params],
    queryFn: () => roomsApi.list(params),
    placeholderData: keepPreviousData,
    ...options,
  });

/** Rooms of one hostel via GET /hostels/:id/rooms. */
export const useHostelRooms = (hostelId, params = {}) =>
  useQuery({
    queryKey: ['rooms', 'hostel', hostelId, params],
    queryFn: () => hostelsApi.rooms(hostelId, params),
    enabled: Boolean(hostelId),
  });

export const useRoom = (id) =>
  useQuery({ queryKey: ['rooms', 'detail', id], queryFn: () => roomsApi.get(id), enabled: Boolean(id) });

export const useCreateRoom = () => useResourceMutation(roomsApi.create, KEYS);
export const useUpdateRoom = () => useResourceMutation(({ id, ...body }) => roomsApi.update(id, body), KEYS);
export const useDeleteRoom = () => useResourceMutation((id) => roomsApi.remove(id), KEYS);
