import { LinkOutlined } from "@ant-design/icons";
import { Button, Input, Segmented, message } from "antd";
import { useEffect, useState } from "react";
import { apiErrorMessage } from "../../habitfer/format";
import { deleteMyVideo, saveMyVideo } from "../api";
import { myVideos } from "../hooks";
import type { CuratedVideo } from "../types";
import { VideoPlayer } from "./VideoPlayer";

type Props = {
  target: "exercise" | "routine";
  /** La clave del ejercicio, o el id de la rutina propia o la clave de la lista. */
  targetKey: string;
  /** El video escogido para este ejercicio o rutina, si lo hay. */
  curated?: CuratedVideo | null;
  /** «este ejercicio», «esta rutina». */
  what: string;
};

/** El video de un ejercicio o una rutina: el escogido o el que pegó la persona, y pegar o quitar el suyo. */
export function VideoBlock({ target, targetKey, curated, what }: Props) {
  const videos = myVideos.use();
  const mine = videos?.find((v) => v.target === target && v.key === targetKey) ?? null;
  const [show, setShow] = useState<"mine" | "curated">(mine ? "mine" : "curated");
  const [pasting, setPasting] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setShow(mine ? "mine" : "curated"), [mine]);

  const current =
    show === "mine" && mine
      ? { id: mine.videoId, start: mine.start, title: mine.title ?? "Tu video", channel: mine.channel }
      : curated
        ? { id: curated.id, start: curated.start ?? 0, title: curated.title, channel: curated.channel }
        : mine
          ? { id: mine.videoId, start: mine.start, title: mine.title ?? "Tu video", channel: mine.channel }
          : null;

  const save = async () => {
    if (!url.trim()) {
      message.warning("Pega el link del video de YouTube.");
      return;
    }
    setBusy(true);
    try {
      const v = await saveMyVideo({ target, key: targetKey, url: url.trim() });
      myVideos.set([v, ...(myVideos.get() ?? []).filter((x) => x.id !== v.id && !(x.target === target && x.key === targetKey))]);
      setShow("mine");
      setPasting(false);
      setUrl("");
      message.success("Video guardado");
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo guardar el video"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!mine) return;
    setBusy(true);
    try {
      await deleteMyVideo(mine.id);
      myVideos.set((myVideos.get() ?? []).filter((x) => x.id !== mine.id));
      message.success("Quitaste tu video");
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo quitar"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="fit-videoblock" aria-label="Video">
      {current ? (
        <>
          <VideoPlayer id={current.id} start={current.start} title={current.title} />
          <span className="fit-hint">
            {current.title}
            {current.channel ? ` · ${current.channel}` : ""}
          </span>
          {mine && curated && (
            <Segmented
              size="small"
              value={show}
              onChange={(v) => setShow(v as "mine" | "curated")}
              options={[
                { value: "mine", label: "Mi video" },
                { value: "curated", label: "Recomendado" },
              ]}
            />
          )}
        </>
      ) : (
        <span className="fit-hint">Aún no hay video para {what}. Puedes pegar el link de uno de YouTube.</span>
      )}
      {pasting ? (
        <div className="fit-videoblock__paste">
          <Input
            autoFocus
            allowClear
            inputMode="url"
            placeholder="https://youtu.be/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPressEnter={() => void save()}
            aria-label="Link del video de YouTube"
          />
          <div className="fit-actions">
            <Button type="primary" loading={busy} onClick={() => void save()}>
              Guardar
            </Button>
            <Button onClick={() => setPasting(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="fit-actions">
          <Button size="small" icon={<LinkOutlined />} onClick={() => setPasting(true)}>
            {mine ? "Cambiar mi video" : "Pegar un video de YouTube"}
          </Button>
          {mine && (
            <Button size="small" type="link" danger loading={busy} onClick={() => void remove()}>
              Quitar mi video
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
