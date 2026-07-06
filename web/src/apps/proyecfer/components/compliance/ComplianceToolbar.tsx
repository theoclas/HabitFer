import { DatePicker, Segmented, Select, Space } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import type { WorkspaceUser } from "../../../../types/proyecfer";

export type ComplianceRangePreset = "7d" | "30d" | "90d" | "custom";

type Props = {
  preset: ComplianceRangePreset;
  onPresetChange: (preset: ComplianceRangePreset) => void;
  customRange: [Dayjs, Dayjs] | null;
  onCustomRangeChange: (range: [Dayjs, Dayjs] | null) => void;
  assigneeId: string | null;
  onAssigneeChange: (id: string | null) => void;
  members: WorkspaceUser[];
};

export function ComplianceToolbar({
  preset,
  onPresetChange,
  customRange,
  onCustomRangeChange,
  assigneeId,
  onAssigneeChange,
  members,
}: Props) {
  return (
    <Space wrap className="compliance-toolbar">
      <Segmented
        value={preset}
        onChange={(v) => onPresetChange(v as ComplianceRangePreset)}
        options={[
          { label: "7 dias", value: "7d" },
          { label: "30 dias", value: "30d" },
          { label: "90 dias", value: "90d" },
          { label: "Personalizado", value: "custom" },
        ]}
      />
      {preset === "custom" && (
        <DatePicker.RangePicker
          value={customRange ?? undefined}
          onChange={(dates) => {
            if (dates?.[0] && dates?.[1]) onCustomRangeChange([dates[0], dates[1]]);
          }}
          allowClear={false}
          format="DD MMM YYYY"
        />
      )}
      <Select
        allowClear
        placeholder="Filtrar por asignado"
        style={{ minWidth: 200 }}
        value={assigneeId ?? undefined}
        onChange={(v) => onAssigneeChange(v ?? null)}
        options={members.map((m) => ({ value: m.id, label: m.fullName }))}
      />
    </Space>
  );
}

export function presetToRange(preset: ComplianceRangePreset, custom: [Dayjs, Dayjs] | null): { from: string; to: string } {
  const to = dayjs().format("YYYY-MM-DD");
  if (preset === "custom" && custom) {
    return { from: custom[0].format("YYYY-MM-DD"), to: custom[1].format("YYYY-MM-DD") };
  }
  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  const from = dayjs().subtract(days - 1, "day").format("YYYY-MM-DD");
  return { from, to };
}
