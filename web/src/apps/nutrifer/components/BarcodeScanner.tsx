import { CameraOutlined } from "@ant-design/icons";
import { Button, Drawer, Input, message } from "antd";
import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { getDetector, isProductCode } from "../scanner";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Un código leído dos veces igual (o escrito a mano). */
  onCode: (code: string) => void;
};

type State = "starting" | "scanning" | "denied" | "nocamera" | "error";

const STATE_TEXT: Record<Exclude<State, "scanning">, string> = {
  starting: "Abriendo la cámara…",
  denied: "No hay permiso para usar la cámara. Tómale una foto al código o escribe los números.",
  nocamera: "No encontré una cámara. Tómale una foto al código o escribe los números.",
  error: "No se pudo usar la cámara. Tómale una foto al código o escribe los números.",
};

/**
 * Escáner de códigos de barras: cámara trasera, lee unas 6 veces por segundo y acepta cuando lee dos
 * veces lo mismo. Si no hay cámara, una foto del código o escribir los números.
 */
export function BarcodeScanner({ open, onClose, onCode }: Props) {
  const isMobile = useIsMobile();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const done = useRef(onCode);
  done.current = onCode;
  const [state, setState] = useState<State>("starting");
  const [manual, setManual] = useState("");
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setState("starting");
    setManual("");
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer = 0;
    let last = "";
    let hits = 0;
    const stopCamera = () => {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    };
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setState("nocamera");
          return;
        }
        // El lector se prepara mientras el navegador pide el permiso de la cámara.
        const detectorReady = getDetector();
        detectorReady.catch(() => undefined);
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        stream = media;
        // Se cerró mientras arrancaba: apagar la cámara ya.
        if (stopped) return stopCamera();
        const detector = await detectorReady;
        const video = videoRef.current;
        if (stopped || !video) return stopCamera();
        video.srcObject = media;
        await video.play();
        if (stopped) return stopCamera();
        setState("scanning");
        const tick = async () => {
          if (stopped) return;
          try {
            if (video.readyState >= 2) {
              const code = (await detector.detect(video)).map((f) => f.rawValue).find(isProductCode);
              if (code) {
                hits = code === last ? hits + 1 : 1;
                last = code;
                if (hits >= 2) {
                  stopped = true;
                  stopCamera();
                  navigator.vibrate?.(60);
                  done.current(code);
                  return;
                }
              }
            }
          } catch {
            // Un cuadro que no se pudo leer: se sigue con el siguiente.
          }
          timer = window.setTimeout(() => void tick(), 160);
        };
        void tick();
      } catch (err) {
        stopCamera();
        if (stopped) return;
        const name = err instanceof DOMException ? err.name : "";
        setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "nocamera" : "error");
      }
    })();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stopCamera();
    };
  }, [open]);

  /** Leer el código de una foto (cuando la cámara en vivo no sirve). */
  const readPhoto = async (file: File) => {
    setReading(true);
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const detector = await getDetector();
      const code = (await detector.detect(img)).map((f) => f.rawValue).find(isProductCode);
      if (code) onCode(code);
      else message.warning("No encontré un código en la foto. Acércate más, con buena luz, o escribe los números.");
    } catch {
      message.error("No se pudo leer la foto.");
    } finally {
      URL.revokeObjectURL(url);
      setReading(false);
    }
  };

  const typed = manual.replace(/\D/g, "");

  return (
    <Drawer
      title="Código de barras"
      open={open}
      onClose={onClose}
      placement={isMobile ? "bottom" : "right"}
      size={isMobile ? "92dvh" : 520}
      rootClassName="nf-drawer"
      destroyOnHidden
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
      <div className="nf-detail">
        <div className={`nf-scan${state === "scanning" ? " is-live" : ""}`}>
          <video ref={videoRef} playsInline muted aria-label="Cámara" />
          {state === "scanning" ? (
            <div className="nf-scan__frame" aria-hidden="true">
              <i className="nf-scan__laser" />
            </div>
          ) : (
            <p className="nf-scan__msg">{STATE_TEXT[state]}</p>
          )}
        </div>
        <p className="nf-hint" style={{ margin: 0 }}>
          Apunta al código de barras del empaque, sin brillos. En el iPhone, la app instalada pide permiso de cámara cada vez que se abre: es una
          limitación de Apple.
        </p>
        <Button size="large" icon={<CameraOutlined />} loading={reading} onClick={() => fileRef.current?.click()}>
          Tomarle una foto al código
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void readPhoto(file);
          }}
        />
        <div className="nf-field">
          <label className="nf-label" htmlFor="nf-barcode-manual">
            O escribe los números del código
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              id="nf-barcode-manual"
              size="large"
              inputMode="numeric"
              maxLength={14}
              value={manual}
              placeholder="7702025136735"
              onChange={(e) => setManual(e.target.value)}
              onPressEnter={() => isProductCode(typed) && onCode(typed)}
            />
            <Button size="large" type="primary" disabled={!isProductCode(typed)} onClick={() => onCode(typed)}>
              Buscar
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
