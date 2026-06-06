const MAX_VIDEO_MB = 50;

export function isVideoDataUrl(src: string): boolean {
  return src.startsWith('data:video/');
}

export function isImageDataUrl(src: string): boolean {
  return src.startsWith('data:image/');
}

export async function fileToDataUrl(file: File): Promise<string> {
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    throw new Error(`Arquivo muito grande (máx. ${MAX_VIDEO_MB} MB)`);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

export function extensaoMidia(blob: Blob): string {
  if (blob.type === 'application/pdf') return '.pdf';
  if (blob.type.startsWith('video/')) {
    if (blob.type.includes('webm')) return '.webm';
    if (blob.type.includes('quicktime')) return '.mov';
    return '.mp4';
  }
  if (blob.type.includes('png')) return '.png';
  return '.jpg';
}
