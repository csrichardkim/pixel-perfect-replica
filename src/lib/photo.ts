/** Shrinks a phone photo to ~600px wide JPEG so it uploads fast on camp signal. */
export async function compressImage(
  file: Blob,
  maxWidth = 600,
  maxHeight = 900,
  quality = 0.7,
): Promise<Blob> {
  const source = await loadImage(file);
  const w = "naturalWidth" in source ? source.naturalWidth : source.width;
  const h = "naturalHeight" in source ? source.naturalHeight : source.height;
  if (!w || !h) throw new Error("unreadable");
  const scale = Math.min(1, maxWidth / w, maxHeight / h);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no_canvas");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) throw new Error("encode_failed");
  return blob;
}

async function loadImage(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall through */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function storageUrl(relative: string): string {
  const base = import.meta.env["VITE_SUPABASE_URL"] as string;
  return `${base}/storage/v1${relative}`;
}

/** PUT to a signed upload link with progress (0–1). */
export function uploadToSignedUrl(
  path: string,
  token: string,
  blob: Blob,
  onProgress: (p: number) => void,
): Promise<void> {
  const base = import.meta.env["VITE_SUPABASE_URL"] as string;
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const url = `${base}/storage/v1/object/upload/sign/photos/${encoded}?token=${encodeURIComponent(token)}`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("apikey", key);
    xhr.setRequestHeader("content-type", "image/jpeg");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.timeout = 45000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
      } else reject(new Error(`upload_${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.send(blob);
  });
}
