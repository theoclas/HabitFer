/** Fotos en el teléfono: se achican antes de subirlas (más rápido y sin la ubicación del GPS). */

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(new Error("No se pudo leer la foto."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Lado largo de 1600 px en JPEG: unos 300 KB. Al redibujarla se pierde el EXIF (ubicación, fecha) y
 * las fotos HEIC del iPhone quedan en JPEG.
 */
export async function shrinkPhoto(file: File, maxSide = 1600, quality = 0.82): Promise<{ base64: string; mime: "image/jpeg" }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo preparar la foto.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo preparar la foto."))), "image/jpeg", quality),
    );
    return { base64: await blobToBase64(blob), mime: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}
