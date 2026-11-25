import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keeps list filters in the URL query string.
 * `defaults` must be a stable object (define it outside the component).
 * Changing any filter other than `page` resets the page to 1.
 */
export function useUrlFilters(defaults) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const value = searchParams.get(key);
      if (value !== null) result[key] = value;
    }
    result.page = Number(result.page) || 1;
    result.limit = Number(result.limit) || 10;
    return result;
  }, [searchParams, defaults]);

  const setFilters = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            const isDefault = String(defaults[key] ?? '') === String(value ?? '');
            if (value === '' || value === null || value === undefined || isDefault) next.delete(key);
            else next.set(key, String(value));
          }
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, defaults],
  );

  const resetFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const key of Object.keys(defaults)) next.delete(key);
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams, defaults]);

  return { filters, setFilters, resetFilters };
}
