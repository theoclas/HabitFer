import { LoadingOutlined } from "@ant-design/icons";
import { Modal, message } from "antd";
import { useEffect, useRef, useState } from "react";
import { fetchWhatsappSender, startWhatsappSender, type WhatsappSender } from "../../../api/client";

type Props = { open: boolean; onClose: () => void; onLinked: () => void };

const WAITING: Partial<Record<WhatsappSender["state"], string>> = {
  starting: "Preparando el código…",
  connecting: "Conectando con WhatsApp…",
  idle: "Pidiendo un código nuevo…",
  offline: "El servicio de WhatsApp no responde. Intenta en un rato.",
  error: "WhatsApp falló al arrancar. Intenta en un rato.",
};

/**
 * Solo el admin: vincula el celular que envía los avisos, como WhatsApp Web. Muestra el QR que
 * entrega el servidor y lo actualiza solo (cambia cada ~20 s) hasta que el celular quede conectado.
 */
export function WhatsappLinkModal({ open, onClose, onLinked }: Props) {
  const [sender, setSender] = useState<WhatsappSender | null>(null);
  const linkedRef = useRef(onLinked);
  linkedRef.current = onLinked;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    let timer: number | undefined;
    let last: WhatsappSender["state"] | null = null;
    const tick = async (first: boolean) => {
      try {
        // Al abrir, o si el servidor se puso en pausa, se pide un QR nuevo.
        const s = first || last === "idle" ? await startWhatsappSender() : await fetchWhatsappSender();
        if (!alive) return;
        last = s.state;
        setSender(s);
        if (s.state === "open") {
          message.success(s.phone ? `Listo: ${s.phone} quedó conectado` : "Listo: el celular quedó conectado");
          linkedRef.current();
          return;
        }
      } catch {
        // Un fallo de red no cierra la ventana: se reintenta.
      }
      if (alive) timer = window.setTimeout(() => void tick(false), 2500);
    };
    setSender(null);
    void tick(true);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [open]);

  const qr = sender?.state === "qr" ? sender.qr : null;
  const waiting = sender ? WAITING[sender.state] : "Preparando el código…";

  return (
    <Modal open={open} onCancel={onClose} footer={null} centered width={420} title="Conectar el celular que envía" destroyOnHidden>
      <ol className="hf-wa-steps">
        <li>En el otro celular abre WhatsApp.</li>
        <li>
          Entra a <b>Dispositivos vinculados</b> (en Android, menú ⋮; en iPhone, Configuración) y toca <b>Vincular un dispositivo</b>.
        </li>
        <li>Apunta la cámara a este código.</li>
      </ol>
      <div className="hf-wa-qr" aria-live="polite">
        {qr ? (
          <img src={qr} alt="Código QR para vincular WhatsApp" width={260} height={260} />
        ) : (
          <div className="hf-wa-qr__wait">
            <LoadingOutlined />
            <span>{waiting}</span>
          </div>
        )}
      </div>
      <p className="hf-note" style={{ textAlign: "center" }}>
        El código cambia cada 20 segundos; esta ventana lo actualiza sola.
      </p>
    </Modal>
  );
}
