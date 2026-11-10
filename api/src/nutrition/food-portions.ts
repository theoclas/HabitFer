/** Medidas de un alimento que crea la persona (función pura, con pruebas). */

export type OwnPortionInput = {
  /** Con qué porción se escribieron los valores; sin esto, los valores van por 100 g. */
  portionLabel?: string;
  /** Lo que pesa esa porción, si se sabe. */
  portionGrams?: number;
  /** Lo que trae el paquete o la botella entera (g o ml). */
  packageGrams?: number;
};

export type OwnPortion = { label: string; grams: number; isDefault: boolean };

/**
 * La porción con que se escribieron los valores y, si se dijo, el paquete entero. Con los valores
 * por 100 g, el paquete queda como medida por defecto (nadie se come «100 g» de un paquete de 36 g);
 * con una porción, la porción sigue siendo la de por defecto y el paquete es otra opción. Si la
 * porción no tiene peso, el paquete no se puede relacionar con los valores y no se guarda.
 */
export function ownPortions(dto: OwnPortionInput): OwnPortion[] {
  const label = dto.portionLabel?.trim() || (dto.portionGrams ? 'Porción' : '100 g');
  const grams = dto.portionGrams ?? 100;
  const per100 = !dto.portionLabel?.trim() && dto.portionGrams == null;
  const pack = dto.packageGrams != null && dto.packageGrams > 0 && (per100 || dto.portionGrams != null) ? Math.round(dto.packageGrams * 10) / 10 : null;
  if (pack === null || Math.abs(pack - grams) <= 1) return [{ label, grams, isDefault: true }];
  return per100
    ? [
        { label: 'Paquete', grams: pack, isDefault: true },
        { label, grams, isDefault: false },
      ]
    : [
        { label, grams, isDefault: true },
        { label: 'Paquete', grams: pack, isDefault: false },
      ];
}
