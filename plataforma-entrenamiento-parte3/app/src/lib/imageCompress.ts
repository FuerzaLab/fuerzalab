/**
 * Comprime una imagen en el navegador antes de subirla — baja la resolución
 * a un máximo razonable y la reexporta como JPEG, sin que se note a simple
 * vista pero reduciendo el peso varias veces (una foto de celular moderno,
 * sin comprimir, puede pesar 8-15 MB; esto la deja normalmente por debajo
 * de 1-2 MB). Respeta la orientación real de la foto (evita que quede de
 * costado), y si algo falla, devuelve el archivo original tal cual en vez
 * de bloquear la subida.
 */
export async function compressImage(file: File, maxDimension = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
