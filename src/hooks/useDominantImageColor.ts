import { useEffect, useState } from "react";

const FALLBACK_COLOR = "var(--primary)";
const MAX_SAMPLE_SIZE = 64;
const COLOR_BUCKET_SIZE = 24;
const NO_COVER_COLOR = "#ead0d3";
const MONOCHROME_COVER_COLOR = "#dcd1ec";
// Fixed swatches, ordered by hue and shared across screen sizes and themes.
const BOOK_HERO_PALETTE = [
  "#efcac2", "#efcfad", "#efe1af", "#d1e4b7", "#bee2d7", "#bdd9ec",
  "#cbd3ed", "#dfcbec", "#ebcde0",
] as const;

type ColorBucket = {
  count: number;
  totalR: number;
  totalG: number;
  totalB: number;
  score: number;
};

type HslColor = {
  saturation: number;
  lightness: number;
};

export function useDominantImageColor(
  imageUrl?: string | null,
): string {
  return useImageColor(imageUrl, getDominantImageColor, FALLBACK_COLOR);
}

export function useBookHeroColor(imageUrl?: string | null): string {
  return useImageColor(imageUrl, getBookHeroColor, NO_COVER_COLOR);
}

function useImageColor(
  imageUrl: string | null | undefined,
  readColor: (image: HTMLImageElement) => string | null,
  fallbackColor: string,
): string {
  const [sample, setSample] = useState<{ imageUrl: string; color: string | null } | null>(null);

  useEffect(() => {
    if (!imageUrl) return;

    let cancelled = false;
    const image = new Image();
    const finish = (color: string | null) => {
      if (!cancelled) setSample({ imageUrl, color });
    };

    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        finish(readColor(image));
      } catch {
        finish(null);
      }
    };
    image.onerror = () => finish(null);
    image.src = imageUrl;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [imageUrl, readColor]);

  return sample?.imageUrl === imageUrl ? sample?.color ?? fallbackColor : fallbackColor;
}

function getImagePixels(image: HTMLImageElement, smooth = true): Uint8ClampedArray | null {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (sourceWidth <= 0 || sourceHeight <= 0) return null;

  const scale = Math.min(1, MAX_SAMPLE_SIZE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) return null;

  canvas.width = width;
  canvas.height = height;
  // For book heroes, sample individual pixels without browser-dependent resampling filters.
  context.imageSmoothingEnabled = smooth;
  context.drawImage(image, 0, 0, width, height);

  return context.getImageData(0, 0, width, height).data;
}

function getBookHeroColor(image: HTMLImageElement): string | null {
  const pixels = getImagePixels(image, false);
  if (!pixels) return null;

  const counts = BOOK_HERO_PALETTE.map(() => 0);
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 180) continue;

    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const spread = max - min;
    if (spread < 30 || max + min < 52 || max + min > 460) continue;

    const hue = max === red ? (green - blue) / spread
      : max === green ? 2 + (blue - red) / spread
      : 4 + (red - green) / spread;
    const swatch = Math.round((hue * BOOK_HERO_PALETTE.length) / 6 + BOOK_HERO_PALETTE.length) % BOOK_HERO_PALETTE.length;
    counts[swatch] += 1;
  }

  // Prefer the earliest swatch when equally common colors tie.
  const highestCount = Math.max(...counts);
  return highestCount ? BOOK_HERO_PALETTE[counts.indexOf(highestCount)] : MONOCHROME_COVER_COLOR;
}

function getDominantImageColor(image: HTMLImageElement): string | null {
  const pixels = getImagePixels(image);
  if (!pixels) return null;

  const preferredColor = findDominantColor(pixels, {
    maxLightness: 0.78,
    requireSaturation: true,
  });

  return preferredColor ?? findDominantColor(pixels, {
    maxLightness: 0.84,
    requireSaturation: false,
  });
}

function findDominantColor(
  pixels: Uint8ClampedArray,
  options: { maxLightness: number; requireSaturation: boolean },
): string | null {
  const buckets = new Map<string, ColorBucket>();

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 180) continue;

    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const { saturation, lightness } = rgbToHsl(red, green, blue);

    if (lightness < 0.06 || lightness > options.maxLightness) continue;
    if (options.requireSaturation && saturation < 0.12) continue;

    const bucketKey = [
      Math.round(red / COLOR_BUCKET_SIZE),
      Math.round(green / COLOR_BUCKET_SIZE),
      Math.round(blue / COLOR_BUCKET_SIZE),
    ].join(":");
    const bucket = buckets.get(bucketKey) ?? {
      count: 0,
      totalR: 0,
      totalG: 0,
      totalB: 0,
      score: 0,
    };
    const balancedLightness = 1 - Math.abs(lightness - 0.5);
    const weight = 1 + saturation * 2 + balancedLightness * 0.5;

    bucket.count += 1;
    bucket.totalR += red;
    bucket.totalG += green;
    bucket.totalB += blue;
    bucket.score += weight;
    buckets.set(bucketKey, bucket);
  }

  const dominantBucket = Array.from(buckets.values()).sort(
    (first, second) => second.score - first.score || second.count - first.count,
  )[0];

  if (!dominantBucket) return null;

  return `rgb(${Math.round(dominantBucket.totalR / dominantBucket.count)} ${Math.round(
    dominantBucket.totalG / dominantBucket.count,
  )} ${Math.round(dominantBucket.totalB / dominantBucket.count)})`;
}

function rgbToHsl(red: number, green: number, blue: number): HslColor {
  const normalizedRed = red / 255;
  const normalizedGreen = green / 255;
  const normalizedBlue = blue / 255;
  const max = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
  const min = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { saturation: 0, lightness };
  }

  const delta = max - min;
  const saturation = lightness > 0.5
    ? delta / (2 - max - min)
    : delta / (max + min);

  return { saturation, lightness };
}
