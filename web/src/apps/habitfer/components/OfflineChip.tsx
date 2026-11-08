import { useConnectivity } from "../offline";

/** Aviso en el encabezado: sin señal o con cambios esperando para enviarse. */
export function OfflineChip() {
  const { online, pending } = useConnectivity();
  if (online && pending === 0) return null;
  const label = online ? "Enviando cambios" : "Sin conexión";
  const extra = pending > 0 ? ` · ${pending} ${pending === 1 ? "pendiente" : "pendientes"}` : "";
  return (
    <span className={`hf-offline${online ? " is-syncing" : ""}`} role="status">
      <i aria-hidden="true" />
      {label}
      {extra}
    </span>
  );
}
