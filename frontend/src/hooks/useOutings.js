import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { outingsApi } from '../api/outings';
import { useResourceMutation } from './useResourceMutation';

const KEYS = ['outings', 'dashboard'];

export const useOutings = (params) =>
  useQuery({
    queryKey: ['outings', params],
    queryFn: () => outingsApi.list(params),
    placeholderData: keepPreviousData,
  });

export const useCreateOuting = () => useResourceMutation(outingsApi.create, KEYS);
export const useReviewOuting = () => useResourceMutation(({ id, ...body }) => outingsApi.review(id, body), KEYS);
export const useCheckOutOuting = () => useResourceMutation((id) => outingsApi.checkOut(id), KEYS);
export const useCheckInOuting = () => useResourceMutation((id) => outingsApi.checkIn(id), KEYS);
export const useCancelOuting = () => useResourceMutation((id) => outingsApi.cancel(id), KEYS);
