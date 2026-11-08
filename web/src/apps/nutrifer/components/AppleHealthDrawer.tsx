import { AppleFilled, CopyOutlined, KeyOutlined } from "@ant-design/icons";
import { Button, Drawer, Modal, message } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { apiErrorMessage } from "../../habitfer/format";
import { createShortcutKey, deleteShortcutKey } from "../api";
import type { WeightsView } from "../types";

type Props = {
  open: boolean;
  shortcut: WeightsView["shortcut"];
  onClose: () => void;
  onChanged: () => void;
};

/** La dirección a la que el atajo manda el peso (la misma API de la app). */
function shortcutUrl() {
  const base = String(api.defaults.baseURL ?? "/api");
  const abs = /^https?:\/\//.test(base) ? base : `${window.location.origin}${base.startsWith("/") ? "" : "/"}${base}`;
  return `${abs.replace(/\/$/, "")}/nutrition/atajo/peso`;
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    message.success(`${what} copiada`);
  } catch {
    message.info("Mantén presionado el texto para copiarlo.");
  }
}

/**
 * Apple Salud → NutriFer. Una app web no puede leer Apple Salud: un atajo de iOS, cada mañana, busca el último
 * peso y lo manda con una llave propia (la sesión normal vence a las 8 horas).
 */
export function AppleHealthDrawer({ open, shortcut, onClose, onChanged }: Props) {
  const isMobile = useIsMobile();
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, holder] = Modal.useModal();
  const url = shortcutUrl();

  useEffect(() => {
    if (!open) setToken(null);
  }, [open]);

  const create = async () => {
    setBusy(true);
    try {
      const r = await createShortcutKey();
      setToken(r.token);
      onChanged();
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo crear la llave"));
    } finally {
      setBusy(false);
    }
  };

  const regenerate = () =>
    modal.confirm({
      title: "¿Crear otra llave?",
      content: "La llave de ahora deja de servir: tendrás que poner la nueva en el atajo.",
      okText: "Crear otra",
      cancelText: "Cancelar",
      onOk: create,
    });

  const disconnect = () =>
    modal.confirm({
      title: "¿Desconectar Apple Salud?",
      content: "El atajo deja de poder mandar el peso. Las pesadas que ya llegaron se quedan.",
      okText: "Desconectar",
      okButtonProps: { danger: true },
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await deleteShortcutKey();
          setToken(null);
          message.success("Apple Salud quedó desconectado");
          onChanged();
        } catch (err) {
          message.error(apiErrorMessage(err, "No se pudo desconectar"));
        }
      },
    });

  return (
    <Drawer
      title="Peso desde Apple Salud"
      open={open}
      onClose={onClose}
      placement={isMobile ? "bottom" : "right"}
      size={isMobile ? "92dvh" : 560}
      rootClassName="nf-drawer"
      styles={{
        body: {
          paddingBottom: isMobile ? "max(24px, env(safe-area-inset-bottom))" : 24,
          paddingLeft: isMobile ? "max(16px, env(safe-area-inset-left))" : undefined,
          paddingRight: isMobile ? "max(16px, env(safe-area-inset-right))" : undefined,
          overflowX: "hidden",
        },
        wrapper: isMobile ? { maxWidth: "100vw" } : undefined,
      }}
    >
      {holder}
      <div className="nf-detail nf-apple">
        <p className="nf-apple__intro">
          <AppleFilled /> Si tu báscula manda el peso a Apple Salud (Withings, Renpho, Xiaomi, Eufy…), un atajo del iPhone se lo pasa a NutriFer cada
          mañana, sin anotarlo. Una app web no puede leer Apple Salud por sí sola: por eso el atajo.
        </p>

        {shortcut && !token && (
          <div className="nf-note">
            <KeyOutlined />
            <span>
              Conectado con la llave que termina en <b>…{shortcut.hint}</b>.{" "}
              {shortcut.lastUsedAt
                ? `Última vez que llegó un peso: ${dayjs(shortcut.lastUsedAt).format("dddd D [de] MMMM, h:mm a")}.`
                : "Aún no ha llegado ningún peso: prueba el atajo."}
            </span>
          </div>
        )}

        <section>
          <h3 className="nf-apple__step">1. Tu llave</h3>
          {token ? (
            <>
              <p className="nf-hint" style={{ margin: "0 0 8px" }}>
                Cópiala ahora y pégala en el atajo: por seguridad no se vuelve a mostrar.
              </p>
              <div className="nf-codebox">
                <code>{token}</code>
                <Button icon={<CopyOutlined />} onClick={() => void copy(token, "Llave")}>
                  Copiar
                </Button>
              </div>
            </>
          ) : shortcut ? (
            <div className="nf-actions nf-actions--start">
              <Button onClick={regenerate} loading={busy}>
                Crear otra llave
              </Button>
              <Button danger onClick={disconnect}>
                Desconectar
              </Button>
            </div>
          ) : (
            <Button type="primary" icon={<KeyOutlined />} loading={busy} onClick={() => void create()}>
              Crear mi llave
            </Button>
          )}
        </section>

        <section>
          <h3 className="nf-apple__step">2. El atajo (una sola vez)</h3>
          <ol className="nf-steps">
            <li>
              En el iPhone abre <b>Atajos</b> → <b>Automatización</b> → <b>+</b> → <b>Hora del día</b>: por ejemplo a las 9:00 a. m., todos los días, y
              marca <b>Ejecutar inmediatamente</b>.
            </li>
            <li>
              Agrega la acción <b>Buscar muestras de Salud</b>: tipo <b>Peso</b>, ordenar por <b>Fecha de inicio</b>, <b>Más reciente primero</b>,
              límite <b>1</b>.
            </li>
            <li>
              Agrega <b>Obtener contenido de URL</b> con esta dirección:
              <div className="nf-codebox nf-codebox--sm">
                <code>{url}</code>
                <Button size="small" icon={<CopyOutlined />} onClick={() => void copy(url, "Dirección")}>
                  Copiar
                </Button>
              </div>
              Método <b>POST</b> y cuerpo <b>JSON</b> con dos campos: <code>llave</code> (texto: tu llave) y <code>peso</code> (número: la variable{" "}
              <i>Muestras de Salud</i>).
            </li>
            <li>
              Opcional: un campo <code>fecha</code> con la <i>Fecha de inicio</i> de la muestra (acción <b>Formatear fecha</b>, formato ISO 8601), para que
              cuente el día en que te pesaste y no el día en que corrió el atajo.
            </li>
            <li>
              Tócalo para probar: el peso aparece en <b>Progreso</b> con el ícono <AppleFilled />. Si la llave está mal, el atajo muestra «Esa llave no
              sirve».
            </li>
          </ol>
          <p className="nf-hint" style={{ margin: 0 }}>
            Si llegan dos pesos el mismo día, queda el último. Puedes seguir anotando a mano cuando quieras.
          </p>
        </section>
      </div>
    </Drawer>
  );
}
