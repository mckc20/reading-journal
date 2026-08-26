import { useEffect, useState } from "react";

const FALLBACK_COLOR = "var(--primary)";
const MAX_SAMPLE_SIZE = 64;
const COLOR_BUCKET_SIZE = 24;

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

export function useDominantImageColor(imageUrl?: string | null): string {
  const [color, setColor] = useState(FALLBACK_COLOR);

  useEffect(() => {
    if (!imageUrl) {
      setColor(FALLBACK_COLOR);
      return;
    }

    let cancelled = false;
    const image = new Image();

    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const nextColor = getDominantImageColor(image);
        if (!cancelled) setColor(nextColor ?? FALLBACK_COLOR);
      } catch {
        if (!cancelled) setColor(FALLBACK_COLOR);
      }
    };
    image.onerror = () => {
      if (!cancelled) setColor(FALLBACK_COLOR);
    };
    image.src = imageUrl;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [imageUrl]);

  return color;
}

function getDominantImageColor(image: HTMLImageElement): string | null {
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
  context.drawImage(image, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height).data;
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
