import type { Seal } from "../types";

const TEXT: Record<Seal, [string, string]> = {
  AZUCARES: ["Exceso en", "azúcares"],
  SODIO: ["Exceso en", "sodio"],
  GRASAS_SATURADAS: ["Exceso en", "grasas saturadas"],
  GRASAS_TRANS: ["Exceso en", "grasas trans"],
  EDULCORANTE: ["Contiene", "edulcorante"],
};

/** Los octágonos negros de los empaques colombianos (calculados con la Resolución 810). */
export function Seals({ seals }: { seals: Seal[] }) {
  if (seals.length === 0) return null;
  return (
    <div className="nf-seals">
      <div className="nf-seals__row" role="list" aria-label="Sellos de advertencia">
        {seals.map((s) => (
          <span key={s} className="nf-seal" role="listitem" aria-label={`${TEXT[s][0]} ${TEXT[s][1]}`}>
            <small>{TEXT[s][0]}</small>
            <b>{TEXT[s][1]}</b>
          </span>
        ))}
      </div>
      <p className="nf-seals__note">Calculados con los límites de la Resolución 810 de 2021 (los azúcares, con los totales del empaque).</p>
    </div>
  );
}

/** Un octágono chiquito con cuántos sellos tiene (en las listas). */
export function SealCount({ seals }: { seals?: Seal[] }) {
  if (!seals || seals.length === 0) return null;
  const names = seals.map((s) => `${TEXT[s][0]} ${TEXT[s][1]}`.toLowerCase()).join(", ");
  return (
    <span className="nf-seal-mini" title={names} aria-label={`${seals.length} ${seals.length === 1 ? "sello" : "sellos"}: ${names}`}>
      {seals.length}
    </span>
  );
}
