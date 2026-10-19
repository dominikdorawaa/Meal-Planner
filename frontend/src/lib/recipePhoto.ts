export const RECIPE_PHOTO_MAX_SIZE = 1200;
export const RECIPE_PHOTO_QUALITY = 0.8;

export interface Size {
  width: number;
  height: number;
}

export function fitWithin({ width, height }: Size, maxSize: number): Size {
  const longest = Math.max(width, height);
  if (longest <= maxSize) return { width, height };
  const scale = maxSize / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function resizeRecipePhoto(
  file: Blob,
  maxSize = RECIPE_PHOTO_MAX_SIZE,
  quality = RECIPE_PHOTO_QUALITY
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const { width, height } = fitWithin(bitmap, maxSize);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context is not available');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('Could not encode the photo'))),
        'image/jpeg',
        quality
      );
    });
  } finally {
    bitmap.close();
  }
}
