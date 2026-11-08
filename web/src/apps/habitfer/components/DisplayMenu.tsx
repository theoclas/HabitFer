import {
  BellOutlined,
  CheckOutlined,
  CloudDownloadOutlined,
  DownloadOutlined,
  MoonOutlined,
  PauseCircleOutlined,
  SearchOutlined,
  SoundOutlined,
  StarOutlined,
  SunOutlined,
} from "@ant-design/icons";
import { Dropdown, Modal, type MenuProps } from "antd";
import { useState } from "react";
import { playTick, setSoundEnabled, soundEnabled } from "../effects";
import { useInstallState } from "../pwa";
import type { HfThemeMode, HfThemePref } from "../theme/useHfTheme";

type Props = {
  pref: HfThemePref;
  mode: HfThemeMode;
  onPref: (p: HfThemePref) => void;
  onNotifications: () => void;
  /** Pausar todos los habitos (vacaciones). */
  onPause: () => void;
  /** Respaldo: exportar e importar. */
  onBackup: () => void;
  /** Tu mes en HabitFer. */
  onWrapped: () => void;
  /** Paleta de comandos. */
  onSearch: () => void;
};

const OPTIONS: { key: HfThemePref; label: string }[] = [
  { key: "night", label: "Noche" },
  { key: "day", label: "Día" },
  { key: "auto", label: "Automático (como el teléfono)" },
];

/** Ajustes de la app: tema, sonido, notificaciones e instalacion. */
export function DisplayMenu({ pref, mode, onPref, onNotifications, onPause, onBackup, onWrapped, onSearch }: Props) {
  const [sound, setSound] = useState(soundEnabled);
  const { canPrompt, iosManual, promptInstall } = useInstallState();

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
    { key: "search", icon: <SearchOutlined />, label: "Buscar y comandos (Ctrl K)" },
    { key: "wrapped", icon: <StarOutlined />, label: "Tu mes en HabitFer" },
    { key: "notifications", icon: <BellOutlined />, label: "Notificaciones…" },
    { key: "pause", icon: <PauseCircleOutlined />, label: "Pausar todo (vacaciones)…" },
    { key: "backup", icon: <CloudDownloadOutlined />, label: "Respaldo de datos…" },
    {
      key: "sound",
      icon: <SoundOutlined />,
      label: sound ? "Sonido al marcar: activado" : "Sonido al marcar: apagado",
    },
    ...(canPrompt || iosManual
      ? [{ key: "install", icon: <DownloadOutlined />, label: canPrompt ? "Instalar app" : "Instalar en iPhone…" }]
      : []),
  ];

  const onClick: MenuProps["onClick"] = ({ key }) => {
    if (key === "sound") {
      const next = !sound;
      setSoundEnabled(next);
      setSound(next);
      if (next) playTick();
      return;
    }
    if (key === "notifications") {
      onNotifications();
      return;
    }
    if (key === "pause") {
      onPause();
      return;
    }
    if (key === "backup") {
      onBackup();
      return;
    }
    if (key === "wrapped") {
      onWrapped();
      return;
    }
    if (key === "search") {
      onSearch();
      return;
    }
    if (key === "install") {
      if (canPrompt) void promptInstall();
      else
        Modal.info({
          title: "Instalar HabitFer en iPhone",
          content: "En Safari toca Compartir (el cuadro con la flecha hacia arriba) y luego «Agregar a inicio». Después ábrela desde el ícono.",
          okText: "Entendido",
        });
      return;
    }
    onPref(key as HfThemePref);
  };

  return (
    <Dropdown menu={{ items, onClick }} trigger={["click"]} placement="bottomRight">
      <button type="button" className="profile-trigger profile-trigger--habit" aria-label="Ajustes de la app">
        {mode === "day" ? <SunOutlined /> : <MoonOutlined />}
      </button>
    </Dropdown>
  );
}
