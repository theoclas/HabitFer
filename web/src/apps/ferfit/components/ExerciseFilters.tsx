import { SearchOutlined } from "@ant-design/icons";
import { Input } from "antd";
import type { Exercise, Library } from "../types";

export type Filters = { q: string; focus: string | null; equipment: string | null; easy: boolean };
export const NO_FILTERS: Filters = { q: "", focus: null, equipment: null, easy: false };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Los ejercicios que pasan los filtros (búsqueda sin tildes; «sin equipo» = no necesita nada). */
export function filterExercises(list: Exercise[], f: Filters, lib: Library): Exercise[] {
  const words = norm(f.q).split(/\s+/).filter(Boolean);
  return list.filter((e) => {
    if (f.focus && e.focus !== f.focus) return false;
    if (f.equipment === "ninguno" && e.equipment.length > 0) return false;
    if (f.equipment && f.equipment !== "ninguno" && !e.equipment.includes(f.equipment as Exercise["equipment"][number])) return false;
    if (f.easy && (e.level > 1 || e.impact !== "bajo")) return false;
    if (!words.length) return true;
    const text = norm([e.name, ...e.muscles.map((m) => lib.labels.muscles[m] ?? m), lib.labels.focus[e.focus] ?? ""].join(" "));
    return words.every((w) => text.includes(w));
  });
}

type Props = { lib: Library; value: Filters; onChange: (f: Filters) => void; idPrefix: string };

/** Buscar y filtrar por enfoque, equipo y «para empezar». */
export function ExerciseFilters({ lib, value, onChange, idPrefix }: Props) {
  const focusOptions = Object.entries(lib.labels.focus).filter(([k]) => k !== "mixta");
  const equipmentOptions: [string, string][] = [["ninguno", "Sin equipo"], ...Object.entries(lib.labels.equipment)];
  const chip = (pressed: boolean, label: string, onClick: () => void, key: string) => (
    <button key={key} type="button" className="fit-chip" aria-pressed={pressed} onClick={onClick}>
      {label}
    </button>
  );
  return (
    <div className="fit-search">
      <Input
        id={`${idPrefix}-q`}
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Buscar: sentadilla, abdomen, hombros…"
        value={value.q}
        onChange={(e) => onChange({ ...value, q: e.target.value })}
        aria-label="Buscar ejercicios"
      />
      <div className="fit-chips" role="group" aria-label="Enfoque">
        {chip(value.focus === null, "Todos", () => onChange({ ...value, focus: null }), "all")}
        {focusOptions.map(([k, label]) => chip(value.focus === k, label, () => onChange({ ...value, focus: value.focus === k ? null : k }), k))}
      </div>
      <div className="fit-chips" role="group" aria-label="Equipo">
        {chip(value.easy, "Para empezar", () => onChange({ ...value, easy: !value.easy }), "easy")}
        {equipmentOptions.map(([k, label]) => chip(value.equipment === k, label, () => onChange({ ...value, equipment: value.equipment === k ? null : k }), k))}
      </div>
    </div>
  );
}
