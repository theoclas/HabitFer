import { BellOutlined, SendOutlined } from "@ant-design/icons";
import { Button, Modal, Switch, TimePicker, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { fetchPushSettings, sendTestPush, updatePushSettings, type PushSettings } from "../../../api/client";
import { disablePush, enablePush, pushState, type PushState } from "../push";
import { isIos, isStandalone } from "../pwa";

type Props = { open: boolean; onClose: () => void };

const STATE_TEXT: Record<PushState, string> = {
  on: "Activadas en este dispositivo.",
  off: "Apagadas en este dispositivo.",
  denied: "Las bloqueaste en el navegador. Actívalas en los permisos del sitio y vuelve aquí.",
  "needs-install":
    "En iPhone primero instala la app: en Safari toca Compartir y «Agregar a inicio», y ábrela desde el ícono. Necesita iOS 16.4 o más reciente.",
  unsupported: "",
};

/** Notificaciones push de este dispositivo y resumen de la noche. */
export function NotificationsSheet({ open, onClose }: Props) {
  const [state, setState] = useState<PushState | null>(null);
  const [settings, setSettings] = useState<PushSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const iosNeedsInstall = isIos() && !isStandalone();

  const refresh = useCallback(async () => {
    setState(await pushState(iosNeedsInstall));
    setSettings(await fetchPushSettings().catch(() => null));
  }, [iosNeedsInstall]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      message.error((err as Error).message || "No se pudo completar");
    } finally {
      setBusy(false);
    }
  };

  const activate = () =>
    run(async () => {
      const next = await enablePush();
      setState(next);
      if (next === "on") {
        message.success("Listo: este dispositivo recibe tus recordatorios");
        setSettings(await fetchPushSettings().catch(() => settings));
      }
    });

  const deactivate = () =>
    run(async () => {
      setState(await disablePush());
      setSettings(await fetchPushSettings().catch(() => settings));
    });

  const test = () =>
    run(async () => {
      const r = await sendTestPush();
      if (r.sent > 0) message.success("Enviada: debería llegarte en unos segundos");
      else message.warning("No hay dispositivos activos para enviar la prueba");
    });

  const saveSummary = (value: string | null) =>
    run(async () => {
      setSettings(await updatePushSettings({ summaryTime: value }));
    });

  const unsupportedText = !window.isSecureContext
    ? "Las notificaciones necesitan la dirección segura: https://habitfer.fersuastudio.com."
    : "Este navegador no permite notificaciones push.";
  const summaryTime: Dayjs | null = settings?.summaryTime ? dayjs(settings.summaryTime, "HH:mm") : null;

  return (
    <Modal open={open} onCancel={onClose} footer={null} centered width={460} title="Notificaciones">
      <section className="hf-notif">
        <div className="hf-notif__head">
          <BellOutlined />
          <b>Este dispositivo</b>
        </div>
        <p className="hf-note" style={{ marginTop: 4 }}>
          {state === null ? "Revisando…" : state === "unsupported" ? unsupportedText : STATE_TEXT[state]}
        </p>
        {settings && !settings.enabled && (
          <p className="hf-note">El servidor todavía no tiene activadas las notificaciones.</p>
        )}
        <div className="hf-notif__actions">
          {state === "off" && (
            <Button type="primary" loading={busy} onClick={() => void activate()}>
              Activar en este dispositivo
            </Button>
          )}
          {state === "on" && (
            <>
              <Button icon={<SendOutlined />} loading={busy} onClick={() => void test()}>
                Enviar prueba
              </Button>
              <Button loading={busy} onClick={() => void deactivate()}>
                Desactivar
              </Button>
            </>
          )}
        </div>
        {settings && settings.devices > 0 && (
          <p className="hf-note">
            {settings.devices === 1 ? "1 dispositivo recibe tus avisos." : `${settings.devices} dispositivos reciben tus avisos.`}
          </p>
        )}
      </section>

      <section className="hf-notif">
        <div className="hf-notif__head">
          <span aria-hidden="true">🌙</span>
          <b>Resumen de la noche</b>
          <Switch
            style={{ marginLeft: "auto" }}
            checked={Boolean(settings?.summaryTime)}
            disabled={!settings || busy}
            onChange={(on) => void saveSummary(on ? "21:00" : null)}
            aria-label="Resumen de la noche"
          />
        </div>
        <p className="hf-note" style={{ marginTop: 4 }}>
          A esa hora te dice qué te falta del día y qué racha está en riesgo. Si ya cumpliste todo, no te molesta.
        </p>
        {settings?.summaryTime && (
          <TimePicker
            format="HH:mm"
            minuteStep={5}
            value={summaryTime}
            allowClear={false}
            inputReadOnly
            onChange={(v) => v && void saveSummary(v.format("HH:mm"))}
            style={{ marginTop: 10, width: 140 }}
          />
        )}
      </section>

      <p className="hf-note" style={{ marginTop: 14 }}>
        Los avisos de cada hábito se configuran en el hábito: Editar → Recordatorio (hasta 4 horas).
      </p>
    </Modal>
  );
}
