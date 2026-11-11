import { CopyOutlined, DeleteOutlined, KeyOutlined } from "@ant-design/icons";
import { Button, Input, Modal, Select, message } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { apiErrorMessage } from "../../habitfer/format";
import {
  createAgentKey,
  deleteAgentKey,
  fetchAgentKeys,
  fetchAgentReportText,
} from "../api";
import type { AgentKey } from "../types";

const DAY_OPTIONS = [7, 14, 30].map((d) => ({ value: d, label: `${d} días` }));

/** La dirección de la API (la misma de la app), completa. */
function apiBase() {
  const base = String(api.defaults.baseURL ?? "/api");
  const abs = /^https?:\/\//.test(base)
    ? base
    : `${window.location.origin}${base.startsWith("/") ? "" : "/"}${base}`;
  return abs.replace(/\/$/, "");
}

/** Lo que se le pega a Claude con la llave: la llave y cómo usarla. */
function messageForClaude(token: string) {
  const base = apiBase();
  return [
    "Esta es mi llave de NutriFer para que leas el informe de lo que como y me ayudes con la dieta (solo lectura):",
    token,
    `Informe: GET ${base}/nutrition/agent/report?days=14&format=md con el encabezado «Authorization: Bearer <la llave>». Con format=json salen los datos; days va hasta 92, o from=AAAA-MM-DD&to=AAAA-MM-DD.`,
    `Alimentos de la base (valores por 100 g y medidas caseras): GET ${base}/nutrition/agent/foods?q=arepa`,
  ].join("\n");
}

/**
 * Copiar un texto que hay que traer primero. Safari pierde el permiso del toque si se espera la red antes de copiar:
 * por eso va primero con ClipboardItem (acepta una promesa). Devuelve true si copió o el texto, para copiarlo a mano.
 */
async function copyAfter(load: () => Promise<string>): Promise<true | string> {
  const text = load();
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })),
        }),
      ]);
      return true;
    } catch {
      // Sigue con writeText (o a mano).
    }
  }
  const value = await text;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return value;
  }
}

async function copyNow(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    message.success(`${what} copiada`);
  } catch {
    message.info("Mantén presionado el texto para copiarlo.");
  }
}

/**
 * Claude, tu asistente: el informe para pegarlo en cualquier chat (también en el celular) y las llaves para que
 * Claude lo lea solo desde el computador. Todo es de solo lectura.
 */
export function AssistantCard() {
  const [keys, setKeys] = useState<AgentKey[] | null>(null);
  const [days, setDays] = useState(14);
  const [copying, setCopying] = useState(false);
  const [byHand, setByHand] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [modal, holder] = Modal.useModal();

  useEffect(() => {
    fetchAgentKeys()
      .then(setKeys)
      .catch(() => setKeys([]));
  }, []);

  const copyReport = async () => {
    setCopying(true);
    try {
      const r = await copyAfter(() => fetchAgentReportText(days));
      if (r === true)
        message.success("Informe copiado: pégalo en el chat con Claude.");
      else setByHand(r);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo armar el informe"));
    } finally {
      setCopying(false);
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      const r = await createAgentKey(name.trim());
      setToken(r.token);
      setName("");
      setKeys((list) => [r.key, ...(list ?? [])]);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo crear la llave"));
    } finally {
      setCreating(false);
    }
  };

  const remove = (k: AgentKey) =>
    modal.confirm({
      title: `¿Quitar «${k.name}»?`,
      content:
        "Con esa llave Claude ya no podrá leer tu informe. Puedes crear otra cuando quieras.",
      okText: "Quitar",
      okButtonProps: { danger: true },
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await deleteAgentKey(k.id);
          setKeys((list) => (list ?? []).filter((x) => x.id !== k.id));
          message.success("Llave quitada");
        } catch (err) {
          message.error(apiErrorMessage(err, "No se pudo quitar la llave"));
        }
      },
    });

  return (
    <section className="nf-card nf-assist" aria-labelledby="nf-goal-claude">
      {holder}
      <h2 id="nf-goal-claude">Claude, tu asistente</h2>
      <p className="nf-hint" style={{ margin: 0 }}>
        Claude puede leer tu diario, tu peso y tus metas para ayudarte con la
        dieta. Solo lee: no anota, no cambia ni borra nada.
      </p>

      <div className="nf-assist__block">
        <h3 className="nf-assist__title">Copiar el informe</h3>
        <div className="nf-assist__row">
          <Select
            aria-label="Días del informe"
            value={days}
            options={DAY_OPTIONS}
            onChange={setDays}
          />
          <Button
            type="primary"
            icon={<CopyOutlined />}
            loading={copying}
            onClick={() => void copyReport()}
          >
            Copiar informe
          </Button>
        </div>
        <span className="nf-hint">
          Pégalo en cualquier chat con Claude, también en la app del celular.
        </span>
      </div>

      <div className="nf-assist__block">
        <h3 className="nf-assist__title">
          Llaves para Claude en el computador
        </h3>
        <span className="nf-hint">
          Con una llave, Claude Code lee tu informe solo, sin que copies nada.
        </span>
        {keys && keys.length > 0 && (
          <ul className="nf-assist__keys">
            {keys.map((k) => (
              <li key={k.id} className="nf-assist__key">
                <span className="nf-assist__icon" aria-hidden="true">
                  <KeyOutlined />
                </span>
                <div className="nf-assist__keybody">
                  <b>{k.name}</b>
                  <small>
                    Termina en …{k.hint} · creada el{" "}
                    {dayjs(k.createdAt).format("D [de] MMMM")} ·{" "}
                    {k.lastUsedAt
                      ? `la usó el ${dayjs(k.lastUsedAt).format("D [de] MMMM, h:mm a")}`
                      : "aún no la ha usado"}
                  </small>
                </div>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={`Quitar la llave ${k.name}`}
                  onClick={() => remove(k)}
                />
              </li>
            ))}
          </ul>
        )}

        {token ? (
          <div className="nf-note nf-assist__token">
            <KeyOutlined />
            <div className="nf-assist__tokenbody">
              <span>
                Cópiala ahora y pégasela a Claude: por seguridad no se vuelve a
                mostrar.
              </span>
              <div className="nf-codebox">
                <code>{token}</code>
              </div>
              <div className="nf-assist__row">
                <Button
                  type="primary"
                  icon={<CopyOutlined />}
                  onClick={() =>
                    void copyNow(
                      messageForClaude(token),
                      "Llave con instrucciones",
                    )
                  }
                >
                  Copiar para Claude
                </Button>
                <Button onClick={() => void copyNow(token, "Llave")}>
                  Solo la llave
                </Button>
                <Button type="text" onClick={() => setToken(null)}>
                  Listo
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="nf-assist__row">
            <Input
              className="nf-assist__name"
              aria-label="Nombre de la llave"
              placeholder="Nombre, p. ej. Claude en el PC"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onPressEnter={() => void create()}
            />
            <Button
              icon={<KeyOutlined />}
              loading={creating}
              onClick={() => void create()}
            >
              Crear llave
            </Button>
          </div>
        )}
      </div>

      <Modal
        open={byHand !== null}
        title="Copia el informe"
        onCancel={() => setByHand(null)}
        footer={<Button onClick={() => setByHand(null)}>Cerrar</Button>}
      >
        <p className="nf-hint" style={{ marginTop: 0 }}>
          El navegador no dejó copiarlo solo: toca el texto, elige «Seleccionar
          todo» y cópialo.
        </p>
        <Input.TextArea
          value={byHand ?? ""}
          readOnly
          autoSize={{ minRows: 8, maxRows: 14 }}
          onFocus={(e) => e.currentTarget.select()}
        />
      </Modal>
    </section>
  );
}
