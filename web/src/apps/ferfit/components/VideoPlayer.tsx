import { CaretRightFilled } from "@ant-design/icons";
import { useEffect, useState } from "react";

type Props = { id: string; start?: number; title: string };

/**
 * Un video de YouTube con el reproductor oficial en su modo de privacidad. Primero solo se ve la portada: el
 * reproductor (y la conexión con YouTube) se carga al tocarla.
 */
export function VideoPlayer({ id, start = 0, title }: Props) {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(false), [id, start]);
  const src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1${start ? `&start=${start}` : ""}`;
  return (
    <div className="fit-video">
      {on ? (
        <iframe
          src={src}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button type="button" className="fit-video__poster" onClick={() => setOn(true)} aria-label={`Ver el video: ${title}`}>
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
          <span className="fit-video__play" aria-hidden="true">
            <CaretRightFilled />
          </span>
        </button>
      )}
    </div>
  );
}
