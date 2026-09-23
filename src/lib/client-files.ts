export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_BYTES = 2.5 * 1024 * 1024;
export function validateFile(file: File, pdf = false) {
  const allowed = pdf ? ['application/pdf'] : ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) throw new Error(pdf ? 'Selecciona un archivo PDF.' : 'Selecciona una imagen JPG, PNG o WebP.');
  if (file.size > (pdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES)) throw new Error(pdf ? 'El PDF debe pesar como máximo 2,5 MB.' : 'La imagen debe pesar como máximo 10 MB.');
  if (!file.size) throw new Error('El archivo está vacío.');
}
export function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}
export function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo abrir la imagen. Prueba con otra foto.'));
    img.src = source;
  });
}
export async function prepareImage(file: File) {
  validateFile(file);
  const img = await loadImage(await readDataUrl(file));
  const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Tu navegador no permite procesar imágenes.');
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.88);
}
export async function rotateImage(source: string, degrees: number) {
  const img = await loadImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = img.height; canvas.height = img.width;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Tu navegador no permite girar imágenes.');
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(degrees * Math.PI / 180);
  context.drawImage(img, -img.width / 2, -img.height / 2);
  return canvas.toDataURL('image/jpeg', 0.95);
}
export async function apiPost(body: Record<string, unknown>) {
  const response = await fetch('/api/players', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo guardar. Intenta nuevamente.');
  return data;
}
export async function uploadDataUrl(source: string, fileName: string) {
  const match = source.match(/^data:(image\/(?:png|jpeg)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('Formato de archivo no admitido.');
  const result = await apiPost({ action: 'UPLOAD_FILE', fileData: match[2], mimeType: match[1], fileName });
  if (typeof result.url !== 'string' || !result.url) throw new Error('La subida no devolvió un documento válido.');
  return result.url as string;
}
