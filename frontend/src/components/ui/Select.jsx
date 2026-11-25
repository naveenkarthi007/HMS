import { forwardRef, useId } from 'react';
import { Field } from './Input';

/**
 * Native select. `options` is [{ value, label }]. Pass `placeholder` to add an empty first option.
 */
const Select = forwardRef(function Select(
  { label, error, hint, required, options = [], placeholder, className = '', id, ...props },
  ref,
) {
  const autoId = useId();
  const selectId = id || autoId;
  return (
    <Field id={selectId} label={label} error={error} hint={hint} required={required} className={className}>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={Boolean(error)}
        className={`form-control pr-8 ${error ? 'form-control-error' : ''}`}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
});

export default Select;
