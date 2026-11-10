import { ValidateBy, type ValidationOptions } from 'class-validator';
import { isDateKey, MAX_AMOUNT } from '../fernance.utils';

/** Una fecha AAAA-MM-DD que existe (el 30 de febrero no pasa). */
export function IsDateKey(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isDateKey',
      validator: {
        validate: (value: unknown) => isDateKey(value),
        defaultMessage: () =>
          'La fecha no es válida (usa AAAA-MM-DD y un día que exista).',
      },
    },
    options,
  );
}

/** Un valor en pesos: número entre 1 y lo que cabe en la base de datos. */
export function IsMoney(
  label = 'El monto',
  options?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isMoney',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'number' &&
          Number.isFinite(value) &&
          value >= 1 &&
          value <= MAX_AMOUNT,
        defaultMessage: (args) => {
          const v: unknown = args?.value;
          if (typeof v !== 'number' || !Number.isFinite(v))
            return `${label} debe ser un número.`;
          if (v < 1) return `${label} debe ser de al menos $ 1.`;
          return `${label} es demasiado grande.`;
        },
      },
    },
    options,
  );
}
