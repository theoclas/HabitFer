import { DeleteOutlined, QrcodeOutlined, SendOutlined, WhatsAppOutlined } from "@ant-design/icons";
import { Button, Input, Modal, Segmented, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import {
  addWhatsappNumber,
  fetchWhatsapp,
  logoutWhatsappSender,
  removeWhatsappNumber,
  sendTestWhatsapp,
  updateWhatsappLevel,
  type EmailLevel,
  type WhatsappSettings,
} from "../../../api/client";
import { apiErrorMessage } from "../format";
import { WhatsappLinkModal } from "./WhatsappLinkModal";

type Props = { open: boolean; summaryTime: string | null };

const OPTIONS: { label: string; value: EmailLevel }[] = [
  { label: "Apagado", value: "OFF" },
  { label: "Resumen", value: "SUMMARY" },
  { label: "Todo", value: "ALL" },
];

const HINT: Record<EmailLevel, string> = {
  OFF: "No te llegan mensajes.",
  SUMMARY: "Te llega el resumen de la noche y el mensaje del coach de cada domingo.",
  ALL: "Te llega cada recordatorio de tus hábitos y tareas, con un enlace para marcarlo hecho, además del resumen y el coach.",
};

function senderLine(wa: WhatsappSettings): string {
  const { state, phone } = wa.sender;
  if (state === "open") return phone ? `Los envía el ${phone}.` : "El celular que envía está conectado.";
  if (state === "offline") return "El servicio de WhatsApp no responde.";
  if (state === "error") return "El servicio de WhatsApp tuvo un error; se está reintentando.";
  return wa.isAdmin ? "El celular que envía no está conectado: conéctalo con el botón de abajo." : "El celular que envía todavía no está conectado.";
}

/** Avisos por WhatsApp: tus números (máximo 2), qué te llega y, si eres admin, el celular que envía. */
export function WhatsappSection({ open, summaryTime }: Props) {
  const [wa, setWa] = useState<WhatsappSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [linking, setLinking] = useState(false);
  const [modal, contextHolder] = Modal.useModal();

  const refresh = useCallback(async () => {
    try {
      setWa(await fetchWhatsapp());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo completar"));
    } finally {
      setBusy(false);
    }
  };

  const add = () =>
    run(async () => {
      if (!phone.trim()) return;
      setWa(await addWhatsappNumber(phone.trim()));
      setPhone("");
      message.success("Número agregado");
    });

  const remove = (id: string) => run(async () => setWa(await removeWhatsappNumber(id)));
  const saveLevel = (level: EmailLevel) => run(async () => setWa(await updateWhatsappLevel(level)));

  const test = () =>
    run(async () => {
      const r = await sendTestWhatsapp();
      if (r.errors.length) message.warning(`Salió a ${r.sent} de ${r.total}. ${r.errors.join(" · ")}`);
      else message.success(r.sent === 1 ? "Enviado: revisa tu WhatsApp" : `Enviado a tus ${r.sent} números`);
    });

  const unlink = () =>
    modal.confirm({
      title: "¿Desvincular el celular que envía?",
      content: "Los avisos por WhatsApp se detienen hasta que vuelvas a escanear el código.",
      okText: "Desvincular",
      okButtonProps: { danger: true },
      cancelText: "Cancelar",
      onOk: () =>
        run(async () => {
          await logoutWhatsappSender();
          await refresh();
        }),
    });

  const connected = wa?.sender.state === "open";

  return (
    <section className="hf-notif">
      {contextHolder}
      <div className="hf-notif__head">
        <WhatsAppOutlined />
        <b>Por WhatsApp</b>
      </div>
      {!wa ? (
        <p className="hf-note" style={{ marginTop: 4 }}>
          {failed ? "No se pudo revisar WhatsApp." : "Revisando…"}
        </p>
      ) : !wa.available ? (
        <p className="hf-note" style={{ marginTop: 4 }}>
          WhatsApp todavía no está configurado en el servidor.
        </p>
      ) : (
        <>
          <p className="hf-note" style={{ marginTop: 4 }}>
            {senderLine(wa)}
          </p>
          {wa.isAdmin && (
            <div className="hf-notif__actions">
              {connected ? (
                <Button size="small" danger onClick={unlink} disabled={busy}>
                  Desvincular el celular
                </Button>
              ) : (
                <Button icon={<QrcodeOutlined />} onClick={() => setLinking(true)}>
                  Conectar el celular que envía
                </Button>
              )}
            </div>
          )}

          <div className="hf-wa-numbers">
            {wa.numbers.map((n) => (
              <div className="hf-wa-number" key={n.id}>
                <WhatsAppOutlined aria-hidden="true" />
                <span className="hf-wa-number__phone">{n.phone}</span>
                <Button
                  size="small"
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() => void remove(n.id)}
                  disabled={busy}
                  aria-label={`Quitar ${n.phone}`}
                />
              </div>
            ))}
          </div>
          {wa.numbers.length < wa.maxNumbers && (
            <div className="hf-wa-add">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onPressEnter={() => void add()}
                placeholder="+57 300 123 4567"
                inputMode="tel"
                autoComplete="tel"
                maxLength={30}
                aria-label="Número de WhatsApp"
              />
              <Button onClick={() => void add()} loading={busy} disabled={!phone.trim()}>
                Agregar
              </Button>
            </div>
          )}
          <p className="hf-note" style={{ marginTop: 6 }}>
            {wa.numbers.length === 0 ? `Agrega hasta ${wa.maxNumbers} números tuyos.` : `Hasta ${wa.maxNumbers} números.`}
          </p>

          <Segmented<EmailLevel>
            block
            options={OPTIONS}
            value={wa.level}
            disabled={busy}
            onChange={(value) => void saveLevel(value)}
            style={{ marginTop: 10 }}
          />
          <p className="hf-note" style={{ marginTop: 8 }}>
            {HINT[wa.level]}
            {wa.level !== "OFF" && !summaryTime && " El resumen solo llega si activas «Resumen de la noche» arriba."}
          </p>
          {connected && wa.numbers.length > 0 && (
            <div className="hf-notif__actions">
              <Button icon={<SendOutlined />} loading={busy} onClick={() => void test()}>
                Enviar mensaje de prueba
              </Button>
            </div>
          )}
        </>
      )}
      {wa?.isAdmin && (
        <WhatsappLinkModal
          open={linking}
          onClose={() => setLinking(false)}
          onLinked={() => {
            setLinking(false);
            void refresh();
          }}
        />
      )}
    </section>
  );
}
