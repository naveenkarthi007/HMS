import { getFieldErrors } from '../api/client';

/**
 * Maps API field errors ({ field: message }) onto react-hook-form fields.
 * Returns true when at least one field error was applied.
 */
export function applyServerErrors(error, setError, fieldMap = {}) {
  const details = getFieldErrors(error);
  let applied = false;
  for (const [field, message] of Object.entries(details)) {
    if (typeof message !== 'string') continue;
    setError(fieldMap[field] || field, { type: 'server', message });
    applied = true;
  }
  return applied;
}
