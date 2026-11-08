import { CloseOutlined } from "@ant-design/icons";
import { Button, message } from "antd";
import { useState } from "react";
import { useInstallState } from "../pwa";

const KEY = "hf_install_dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Invitacion a instalar HabitFer como app (Android: boton; iPhone: instrucciones de Safari). */
export function InstallCard() {
  const { canPrompt, iosManual, promptInstall } = useInstallState();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed || (!canPrompt && !iosManual)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* sin almacenamiento */
    }
    setDismissed(true);
  };

  const install = async () => {
    const ok = await promptInstall();
    if (ok) message.success("HabitFer quedó instalada. Ábrela desde el ícono.");
  };

  return (
    <section className="hf-install" aria-label="Instalar HabitFer">
      <img src="/icons/icon-192.png" alt="" width={44} height={44} />
      <div className="hf-install__text">
        <b>Instala HabitFer en tu teléfono</b>
        {canPrompt ? (
          <span>Con su ícono, a pantalla completa y con notificaciones.</span>
        ) : (
          <span>
            En Safari toca <strong>Compartir</strong> <span aria-hidden="true">⬆︎</span> y luego <strong>Agregar a inicio</strong>.
          </span>
        )}
      </div>
      {canPrompt && (
        <Button type="primary" onClick={() => void install()}>
          Instalar
        </Button>
      )}
      <button type="button" className="hf-install__close" aria-label="No mostrar más" onClick={dismiss}>
        <CloseOutlined />
      </button>
    </section>
  );
}
