import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * useMutation + invalidation of the given top-level query keys on success.
 * Errors are toasted globally by the MutationCache (see main.jsx) unless `silent` is set,
 * which is useful when the caller renders the error inline instead.
 */
export function useResourceMutation(mutationFn, invalidate = [], { silent = false } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    meta: { silent },
    onSuccess: () => Promise.all(invalidate.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
  });
}
