import { afterEach, describe, expect, it, vi } from 'vitest';
import { RECIPE_PHOTO_MAX_SIZE, RECIPE_PHOTO_QUALITY, fitWithin, resizeRecipePhoto } from './recipePhoto';

interface FakeCanvas {
  width: number;
  height: number;
  getContext: ReturnType<typeof vi.fn>;
  toBlob: ReturnType<typeof vi.fn>;
}

function fakeCanvas(context: unknown, blob: Blob | null): FakeCanvas {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toBlob: vi.fn((callback: (result: Blob | null) => void) => callback(blob)),
  };
}

function stubBitmap(width: number, height: number) {
  const bitmap = { width, height, close: vi.fn() };
  const createImageBitmap = vi.fn().mockResolvedValue(bitmap);
  vi.stubGlobal('createImageBitmap', createImageBitmap);
  return { bitmap, createImageBitmap };
}

function stubCanvas(canvas: FakeCanvas) {
  const createElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
    tag === 'canvas' ? canvas : createElement(tag)) as typeof document.createElement);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fitWithin', () => {
  it('keeps small photos as they are', () => {
    expect(fitWithin({ width: 800, height: 600 }, 1200)).toEqual({ width: 800, height: 600 });
  });

  it('scales the longer side down to the limit and keeps the proportions', () => {
    expect(fitWithin({ width: 4000, height: 3000 }, 1200)).toEqual({ width: 1200, height: 900 });
    expect(fitWithin({ width: 3000, height: 4000 }, 1200)).toEqual({ width: 900, height: 1200 });
  });

  it('never returns an empty side', () => {
    expect(fitWithin({ width: 10000, height: 1 }, 1200)).toEqual({ width: 1200, height: 1 });
  });
});

describe('resizeRecipePhoto', () => {
  it('draws the photo turned the right way on a white canvas and encodes it as JPEG', async () => {
    const { bitmap, createImageBitmap } = stubBitmap(4000, 3000);
    const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
    const encoded = new Blob(['jpeg'], { type: 'image/jpeg' });
    const canvas = fakeCanvas(context, encoded);
    stubCanvas(canvas);
    const file = new Blob(['photo'], { type: 'image/png' });

    await expect(resizeRecipePhoto(file)).resolves.toBe(encoded);

    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' });
    expect([canvas.width, canvas.height]).toEqual([RECIPE_PHOTO_MAX_SIZE, 900]);
    expect(context.fillStyle).toBe('#ffffff');
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, RECIPE_PHOTO_MAX_SIZE, 900);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, RECIPE_PHOTO_MAX_SIZE, 900);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', RECIPE_PHOTO_QUALITY);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('fails when the browser cannot draw on a canvas', async () => {
    const { bitmap } = stubBitmap(100, 100);
    stubCanvas(fakeCanvas(null, null));

    await expect(resizeRecipePhoto(new Blob(['photo']))).rejects.toThrow('Canvas 2D context is not available');
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('fails when the photo cannot be encoded', async () => {
    stubBitmap(100, 100);
    stubCanvas(fakeCanvas({ fillRect: vi.fn(), drawImage: vi.fn() }, null));

    await expect(resizeRecipePhoto(new Blob(['photo']))).rejects.toThrow('Could not encode the photo');
  });
});
