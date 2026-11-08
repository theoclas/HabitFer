import { CheckOutlined, MoonOutlined, SoundOutlined, SunOutlined } from "@ant-design/icons";
import { Dropdown, type MenuProps } from "antd";
import { useState } from "react";
import { playTick, setSoundEnabled, soundEnabled } from "../effects";
import type { HfThemeMode, HfThemePref } from "../theme/useHfTheme";

type Props = { pref: HfThemePref; mode: HfThemeMode; onPref: (p: HfThemePref) => void };

const OPTIONS: { key: HfThemePref; label: string }[] = [
  { key: "night", label: "Noche" },
  { key: "day", label: "Día" },
  { key: "auto", label: "Automático (como el teléfono)" },
];

/** Tema (noche, dia o automatico) y sonido al marcar. */
export function DisplayMenu({ pref, mode, onPref }: Props) {
  const [sound, setSound] = useState(soundEnabled);

  const items: MenuProps["items"] = [
    {
      type: "group",
      label: "Tema",
      children: OPTIONS.map((o) => ({
        key: o.key,
        label: o.label,
        icon: pref === o.key ? <CheckOutlined /> : <span style={{ display: "inline-block", width: 14 }} />,
      })),
    },
    { type: "divider" },
    {
      key: "sound",
      icon: <SoundOutlined />,
      label: sound ? "Sonido al marcar: activado" : "Sonido al marcar: apagado",
    },
  ];

  const onClick: MenuProps["onClick"] = ({ key }) => {
    if (key === "sound") {
      const next = !sound;
      setSoundEnabled(next);
      setSound(next);
      if (next) playTick();
      return;
    }
    onPref(key as HfThemePref);
  };

  return (
    <Dropdown menu={{ items, onClick }} trigger={["click"]} placement="bottomRight">
      <button type="button" className="profile-trigger profile-trigger--habit" aria-label="Tema y sonido">
        {mode === "day" ? <SunOutlined /> : <MoonOutlined />}
      </button>
    </Dropdown>
  );
}
